import { supabase } from "@/lib/supabase";

/*
 * چرخه عمر اسناد یک سفارش:
 * ۱) ثبت سفارش  -> سند «سفارش فروش» باز می‌شود.
 * ۲) تایید سفارش -> سند سفارش فروش بسته و سند «فاکتور فروش» باز می‌شود.
 * ۳) تحویل سفارش -> فاکتور فروش بسته می‌شود؛ اگر مبلغ/تاریخ نسبت به
 *    زمان تایید تغییر کرده باشد، به‌جای بستن همان سند، یک سند فاکتور
 *    فروش جدید با مقادیر نهایی ثبت و بسته می‌شود.
 * ۴) ابطال سفارش -> هر سند باز آن بدون ثبت سند جدید بسته می‌شود.
 *
 * نکته: تا وقتی جدول order_documents در Supabase ساخته نشده، همه این
 * توابع فقط در کنسول هشدار می‌دهند و در جریان اصلی ثبت/تایید/تحویل
 * سفارش هیچ اختلالی ایجاد نمی‌کنند.
 */

export type OrderDocumentType = "sales_order" | "sales_invoice";

export type OrderDocument = {
  id: string;
  order_id: string;
  doc_type: OrderDocumentType;
  send_date: string | null;
  delivery_date: string | null;
  invoice_total: number | null;
  is_closed: boolean;
  closed_at: string | null;
  created_at: string;
};

export async function openSalesOrderDocument(
  orderId: string,
  snapshot: { invoiceTotal?: number | null }
) {
  const { error } = await supabase.from("order_documents").insert({
    order_id: orderId,
    doc_type: "sales_order",
    invoice_total: snapshot.invoiceTotal ?? null,
  });

  if (error) {
    console.warn("OPEN SALES ORDER DOCUMENT WARNING:", error.message);
  }
}

export async function approveOrderDocuments(
  orderId: string,
  snapshot: { invoiceTotal: number | null; sendDate: string | null }
) {
  /*
   * سند سفارش فروش دقیقاً همین لحظه (تایید) منجمد می‌شود: مقادیرش
   * (مبلغ و تاریخ ارسال) برای همیشه ثابت می‌مانند و دیگر هیچ ویرایش
   * بعدی در انبار روی همین سند اثر نمی‌گذارد.
   */
  const { error: closeError } = await supabase
    .from("order_documents")
    .update({
      is_closed: true,
      closed_at: new Date().toISOString(),
      invoice_total: snapshot.invoiceTotal,
      send_date: snapshot.sendDate,
    })
    .eq("order_id", orderId)
    .eq("doc_type", "sales_order")
    .eq("is_closed", false);

  if (closeError) {
    console.warn("CLOSE SALES ORDER DOCUMENT WARNING:", closeError.message);
  }

  const { error: insertError } = await supabase.from("order_documents").insert({
    order_id: orderId,
    doc_type: "sales_invoice",
    invoice_total: snapshot.invoiceTotal,
    send_date: snapshot.sendDate,
  });

  if (insertError) {
    console.warn("OPEN SALES INVOICE DOCUMENT WARNING:", insertError.message);
  }
}

export async function finalizeInvoiceDocument(
  orderId: string,
  snapshot: {
    invoiceTotal: number | null;
    sendDate: string | null;
    deliveryDate: string | null;
  }
) {
  const { data: openInvoice, error: fetchError } = await supabase
    .from("order_documents")
    .select("*")
    .eq("order_id", orderId)
    .eq("doc_type", "sales_invoice")
    .eq("is_closed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.warn("FETCH OPEN INVOICE DOCUMENT WARNING:", fetchError.message);
    return;
  }

  const closedAt = new Date().toISOString();

  if (!openInvoice) {
    const { error } = await supabase.from("order_documents").insert({
      order_id: orderId,
      doc_type: "sales_invoice",
      invoice_total: snapshot.invoiceTotal,
      send_date: snapshot.sendDate,
      delivery_date: snapshot.deliveryDate,
      is_closed: true,
      closed_at: closedAt,
    });

    if (error) {
      console.warn("INSERT FINAL INVOICE DOCUMENT WARNING:", error.message);
    }

    return;
  }

  const changed =
    Number(openInvoice.invoice_total || 0) !== Number(snapshot.invoiceTotal || 0) ||
    (openInvoice.send_date || null) !== (snapshot.sendDate || null) ||
    (openInvoice.delivery_date || null) !== (snapshot.deliveryDate || null);

  if (!changed) {
    const { error } = await supabase
      .from("order_documents")
      .update({
        is_closed: true,
        closed_at: closedAt,
        delivery_date: snapshot.deliveryDate,
      })
      .eq("id", openInvoice.id);

    if (error) {
      console.warn("CLOSE INVOICE DOCUMENT WARNING:", error.message);
    }

    return;
  }

  const { error: closeError } = await supabase
    .from("order_documents")
    .update({ is_closed: true, closed_at: closedAt })
    .eq("id", openInvoice.id);

  if (closeError) {
    console.warn("CLOSE OLD INVOICE DOCUMENT WARNING:", closeError.message);
  }

  const { error: insertError } = await supabase.from("order_documents").insert({
    order_id: orderId,
    doc_type: "sales_invoice",
    invoice_total: snapshot.invoiceTotal,
    send_date: snapshot.sendDate,
    delivery_date: snapshot.deliveryDate,
    is_closed: true,
    closed_at: closedAt,
  });

  if (insertError) {
    console.warn("INSERT NEW INVOICE DOCUMENT WARNING:", insertError.message);
  }
}

export async function closeOpenDocumentsForOrder(orderId: string) {
  const { error } = await supabase
    .from("order_documents")
    .update({ is_closed: true, closed_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("is_closed", false);

  if (error) {
    console.warn("CLOSE DOCUMENTS ON CANCEL WARNING:", error.message);
  }
}
