"use client";

import { useEffect, useState } from "react";
import { ArrowRight, FileText, Save, Trash2, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";

type ReturnDocument = {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  visitor: string | null;
  status: string | null;
  total_amount: number | null;
  description: string | null;
  created_at: string;
};

type ReturnItem = {
  id: string;
  return_id: string;
  product_id: string | null;
  product_name: string | null;
  barcode: string | null;
  category: string | null;
  quantity_per_carton: number | null;
  return_cartons: number | null;
  return_units: number | null;
  return_total_units: number | null;
  consumer_price_at_sale: number | null;
  discount_percent: number | null;
  deduction_unit_price: number | null;
  total_return_amount: number | null;
  warehouse_received_units: number | null;
  resalable_units: number | null;
  destroyed_units: number | null;
  warehouse_disposition: string | null;
  order_item_id: string | null;
  source_order_id: string | null;
};

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  category: string | null;
  image_url: string | null;
  quantity_per_carton: number | null;
  consumer_price: number | null;
};

type SourceOrderItem = {
  id: string;
  product_id: string;
  final_order_quantity: number | null;
  delivery_cartons: number | null;
  delivery_units: number | null;
  quantity: number | null;
  consumer_price: number | null;
  discount_percent: number | null;
  final_price: number | null;
  products: Product | null;
};

type Customer = {
  id: string;
  name: string | null;
  province: string | null;
};

type Order = {
  id: string;
  order_number: string | number | null;
  delivery_date: string | null;
};

function digits(value: string | number) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function numberValue(value: unknown) {
  return Number(
    String(value ?? "")
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/,/g, "")
  ) || 0;
}

function money(value: number | null | undefined) {
  return `${digits(Number(value || 0).toLocaleString("en-US"))} ریال`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const raw = String(value).trim();
  const datePart = raw.split(/[ T]/)[0];
  const parts = datePart.split("/");

  // تاریخ‌های سفارش در دیتابیس به صورت شمسی YYYY/MM/DD ذخیره شده‌اند.
  // نباید این مقدار را با new Date تفسیر کنیم؛ چون در آن صورت سال شمسی
  // مثل ۱۴۰۵ به عنوان سال میلادی خوانده می‌شود و نتیجه‌ای مثل ۷۸۴ نمایش می‌دهد.
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (
      Number.isInteger(year) &&
      year >= 1300 &&
      year <= 1500 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      const months = [
        "فروردین", "اردیبهشت", "خرداد", "تیر",
        "مرداد", "شهریور", "مهر", "آبان",
        "آذر", "دی", "بهمن", "اسفند",
      ];

      return `${digits(day)} ${months[month - 1]} ${digits(year)}`;
    }
  }

  // اگر مقدار واقعاً میلادی باشد، فقط در این حالت تبدیلش می‌کنیم.
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date);
}

function statusInfo(status: string | null | undefined) {
  switch (String(status || "").toLowerCase()) {
    case "approved":
      return { label: "تایید شده", background: "#dcfce7", color: "#166534" };
    case "delivered":
      return { label: "تحویل انبار", background: "#dbeafe", color: "#1d4ed8" };
    case "cancelled":
      return { label: "باطل شده", background: "#fee2e2", color: "#b91c1c" };
    default:
      return { label: "در انتظار تایید", background: "#fef3c7", color: "#92400e" };
  }
}

function getCartonSize(item: {
  quantity_per_carton?: number | null;
  products?: Product | null;
}) {
  return Math.max(
    Number(item.quantity_per_carton || item.products?.quantity_per_carton || 1),
    1
  );
}

export default function ReturnDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const returnId = params?.id;

  const [document, setDocument] = useState<ReturnDocument | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  const [items, setItems] = useState<ReturnItem[]>([]);
  const [editedItems, setEditedItems] = useState<ReturnItem[]>([]);
  const [sourceItems, setSourceItems] = useState<SourceOrderItem[]>([]);
  const [sourceOrders, setSourceOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (returnId) loadDetail(returnId);
  }, [returnId]);

  async function loadDetail(id: string) {
    setLoading(true);

    try {
      /*
       * مهم:
       * در نسخه قبلی، خطای یکی از queryهای جانبی باعث می‌شد کل صفحه
       * با یک console.error خالی متوقف شود.
       * این نسخه سند و اقلام را جداگانه می‌خواند و خطای مشتری/سفارش
       * باعث از بین رفتن جزئیات سند نمی‌شود.
       */
      const { data: documentData, error: documentError } = await supabase
        .from("return_documents")
        .select("*")
        .eq("id", id)
        .single();

      if (documentError) {
        throw new Error(
          documentError.message || "سند مرجوعی قابل دریافت نیست."
        );
      }

      const { data: itemData, error: itemError } = await supabase
        .from("return_items")
        .select("*")
        .eq("return_id", id);

      if (itemError) {
        throw new Error(
          `اقلام سند قابل دریافت نیستند: ${itemError.message || "خطای نامشخص"}`
        );
      }

      const loadedItems = (itemData || []) as ReturnItem[];

      setDocument(documentData as ReturnDocument);
      setItems(loadedItems);
      setEditedItems(loadedItems);

      if (documentData.customer_id) {
        const { data } = await supabase
          .from("customers")
          .select("id,name,province")
          .eq("id", documentData.customer_id)
          .maybeSingle();

        setCustomer((data || null) as Customer | null);
      }

      const sourceOrderIds = Array.from(
        new Set(
          loadedItems
            .map((item) => item.source_order_id)
            .filter(Boolean) as string[]
        )
      );

      if (sourceOrderIds.length > 0) {
        const { data: sourceOrderRows } = await supabase
          .from("orders")
          .select("id,order_number,delivery_date")
          .in("id", sourceOrderIds);

        setSourceOrders((sourceOrderRows || []) as Order[]);
      }

     if (sourceOrderIds.length > 0) {
        const { data: orderData } = await supabase
  .from("orders")
  .select("id,order_number,delivery_date")
  .in("id", sourceOrderIds)
  .maybeSingle();

        setOrder((orderData || null) as Order | null);

        /*
         * نسخه رسمی سفارش مبنا:
         * فقط کالاهایی که در همان سفارش وجود دارند برای افزودن به
         * سند مرجوعی قابل انتخاب هستند.
         */
        const { data: orderItemData, error: orderItemError } = await supabase
          .from("order_items")
          .select(`
            id,
            product_id,
            final_order_quantity,
            delivery_cartons,
            delivery_units,
            quantity,
            consumer_price,
            discount_percent,
            final_price,
            products(
              id,
              name,
              barcode,
              category,
              image_url,
              quantity_per_carton,
              consumer_price
            )
          `)
          .in("order_id", sourceOrderIds);

        if (!orderItemError) {
          // Supabase may return a one-to-one relation as an array depending on
          // the generated relation metadata. Normalize it before using it as Product | null.
          const normalizedOrderItems: SourceOrderItem[] = (orderItemData || []).map(
            (row: any) => ({
              ...row,
              products: Array.isArray(row.products)
                ? row.products[0] || null
                : row.products || null,
            })
          );

          setSourceItems(normalizedOrderItems);
        } else {
          console.error("SOURCE ORDER ITEMS ERROR:", orderItemError);
          setSourceItems([]);
        }
      }
    } catch (error: any) {
      console.error("RETURN DETAIL LOAD ERROR:", error);
      alert(
        `خطا در دریافت جزئیات مرجوعی: ${
          error?.message || "خطای نامشخص"
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    if (!document) return;

    if (String(document.status || "").toLowerCase() !== "pending") {
      alert(
        "این سند بعد از تأیید قابل ویرایش نیست. برای حفظ سه‌مرحله‌ای بودن سند، فقط سند در انتظار تأیید قابل ویرایش است."
      );
      return;
    }

    setEditedItems(items.map((item) => ({ ...item })));
    setIsEditing(true);
  }

  function cancelEditing() {
    setEditedItems(items.map((item) => ({ ...item })));
    setIsEditing(false);
  }

  function updateReturnUnits(id: string, value: string) {
    const units = Math.max(
      0,
      Math.floor(numberValue(value))
    );

    setEditedItems((previous) =>
      previous.map((item) => {
        if (item.id !== id) return item;

        const cartonSize = getCartonSize(item);
        const source = sourceItems.find(
  (sourceItem) =>
    sourceItem.id === item.order_item_id
);

        const deliveredUnits = getDeliveredUnits(source);
        const safeUnits = Math.min(units, deliveredUnits);

        return {
          ...item,
          return_cartons: 0,
          return_units: safeUnits,
          return_total_units: safeUnits,
          total_return_amount:
            safeUnits * Number(item.deduction_unit_price || 0),
          warehouse_received_units: 0,
        };
      })
    );
  }

  function getDeliveredUnits(source?: SourceOrderItem) {
    if (!source) return 0;

    const cartonSize = Math.max(
      Number(source.products?.quantity_per_carton || 1),
      1
    );

    if (
      source.delivery_units !== null &&
      source.delivery_units !== undefined
    ) {
      return Math.max(0, Number(source.delivery_units));
    }

    if (
      source.delivery_cartons !== null &&
      source.delivery_cartons !== undefined
    ) {
      return Math.max(0, Number(source.delivery_cartons)) * cartonSize;
    }

    if (
      source.final_order_quantity !== null &&
      source.final_order_quantity !== undefined
    ) {
      return Math.max(0, Number(source.final_order_quantity)) * cartonSize;
    }

    return Math.max(0, Number(source.quantity || 0));
  }

  function removeItem(id: string) {
    setEditedItems((previous) =>
      previous.filter((item) => item.id !== id)
    );
  }

  async function saveChanges() {
    if (!document) return;

    if (String(document.status || "").toLowerCase() !== "pending") {
      alert("این سند بعد از تأیید قابل ویرایش نیست.");
      return;
    }

    setSaving(true);

    try {
      const validItems = editedItems.filter(
        (item) => Number(item.return_units || 0) > 0
      );

      if (validItems.length === 0) {
        alert("حداقل یک کالا با تعداد مرجوعی بیشتر از صفر لازم است.");
        setSaving(false);
        return;
      }

      /*
       * کنترل مهم:
       * مرجوعی هیچ کالا نمی‌تواند بیشتر از مقدار تحویلی همان سفارش باشد.
       */
      for (const item of validItems) {
        const source = sourceItems.find(
  (sourceItem) =>
    sourceItem.id === item.order_item_id
);

        const deliveredUnits = getDeliveredUnits(source);
        const returnUnits = Math.max(
          0,
          Math.floor(Number(item.return_units || 0))
        );

        if (returnUnits > deliveredUnits) {
          alert(
            `تعداد مرجوعی «${item.product_name || "-"}» نمی‌تواند بیشتر از تعداد تحویلی باشد.\n\nتحویلی: ${digits(deliveredUnits)} جزء\nمرجوعی: ${digits(returnUnits)} جزء`
          );
          setSaving(false);
          return;
        }
      }

      /*
       * ابتدا اقلامی که از فرم حذف شده‌اند حذف می‌شوند.
       * اقلام موجود فقط در صورت داشتن id واقعی UPDATE می‌شوند.
       */
      const originalIds = new Set(items.map((item) => item.id));
      const currentIds = new Set(
        editedItems
          .filter((item) => !String(item.id).startsWith("new-"))
          .map((item) => item.id)
      );

      for (const oldItem of items) {
        if (!currentIds.has(oldItem.id)) {
          const { error } = await supabase
            .from("return_items")
            .delete()
            .eq("id", oldItem.id)
            .eq("return_id", document.id);

          if (error) throw error;
        }
      }

      const itemsForInsert = validItems
        .filter((item) => String(item.id).startsWith("new-"))
        .map((item) => ({
          return_id: document.id,
          product_id: item.product_id,
          product_name: item.product_name,
          barcode: item.barcode || null,
          category: item.category || null,
          order_item_id: item.order_item_id || null,
          quantity_per_carton: getCartonSize(item),
          return_cartons: 0,
          return_units: Number(item.return_units || 0),
          return_total_units: Number(item.return_units || 0),
          consumer_price_at_sale: Number(
            item.consumer_price_at_sale || 0
          ),
          discount_percent: Number(item.discount_percent || 0),
          deduction_unit_price: Number(
            item.deduction_unit_price || 0
          ),
          total_return_amount:
            Number(item.return_units || 0) *
            Number(item.deduction_unit_price || 0),
          warehouse_received_units: 0,
          resalable_units: 0,
          destroyed_units: 0,
          warehouse_disposition: null,
        }));

      if (itemsForInsert.length > 0) {
        const { error } = await supabase
          .from("return_items")
          .insert(itemsForInsert);

        if (error) throw error;
      }

      for (const item of validItems.filter(
        (item) => !String(item.id).startsWith("new-")
      )) {
        const returnUnits = Number(item.return_units || 0);
        const total = returnUnits * Number(item.deduction_unit_price || 0);

        const { error } = await supabase
          .from("return_items")
          .update({
            return_cartons: 0,
            return_units: returnUnits,
            return_total_units: returnUnits,
            total_return_amount: total,
          })
          .eq("id", item.id)
          .eq("return_id", document.id);

        if (error) throw error;
      }

      const { data: refreshedItems, error: refreshError } = await supabase
        .from("return_items")
        .select("*")
        .eq("return_id", document.id);

      if (refreshError) throw refreshError;

      const refreshed = (refreshedItems || []) as ReturnItem[];
      const newTotal = refreshed.reduce(
        (sum, item) => sum + Number(item.total_return_amount || 0),
        0
      );

      const { error: documentUpdateError } = await supabase
        .from("return_documents")
        .update({
          total_amount: newTotal,
        })
        .eq("id", document.id);

      if (documentUpdateError) throw documentUpdateError;

      setItems(refreshed);
      setEditedItems(refreshed);
      setDocument({
        ...document,
        total_amount: newTotal,
      });
      setIsEditing(false);

      alert("تغییرات سند مرجوعی با موفقیت ذخیره شد.");
    } catch (error: any) {
      console.error("RETURN SAVE ERROR:", error);
      alert(
        `خطا در ذخیره تغییرات مرجوعی: ${
          error?.message || "خطای نامشخص"
        }`
      );
    } finally {
      setSaving(false);
    }
  }


async function cancelReturnDocument() {
  if (!document) return;

  if (String(document.status || "").toLowerCase() !== "pending") {
    alert("فقط سندهای در انتظار تایید قابل ابطال هستند.");
    return;
  }

  const confirmCancel = confirm(
    "آیا مطمئن هستید این سند مرجوعی ابطال شود؟"
  );

  if (!confirmCancel) return;

  setSaving(true);

  try {
    const { data, error } = await supabase
      .from("return_documents")
      .update({
        status: "cancelled",
      })
      .eq("id", document.id)
      .select("*")
      .single();

    if (error) throw error;

    setDocument(data as ReturnDocument);

    alert("سند مرجوعی با موفقیت ابطال شد.");

  } catch (error: any) {
    console.error("CANCEL RETURN ERROR:", error);
    alert(
      `خطا در ابطال سند: ${
        error?.message || "خطای نامشخص"
      }`
    );
  } finally {
    setSaving(false);
  }
}




  async function approveReturnDocument() {
    if (!document) return;

    if (String(document.status || "").toLowerCase() !== "pending") {
      alert("این سند قبلاً ثبت نهایی شده است.");
      return;
    }

    if (isEditing) {
      alert("ابتدا ویرایش را ذخیره کنید.");
      return;
    }

    if (items.length === 0) {
      alert("این سند هیچ قلمی برای ثبت نهایی ندارد.");
      return;
    }

    const invalidItem = items.find(
      (item) => Number(item.return_units || 0) <= 0
    );

    if (invalidItem) {
      alert(
        `تعداد مرجوعی کالای «${invalidItem.product_name || "-"}» باید بیشتر از صفر باشد.`
      );
      return;
    }

    for (const item of items) {
      const source = sourceItems.find(
  (sourceItem) =>
    sourceItem.id === item.order_item_id
);
      const deliveredUnits = getDeliveredUnits(source);
      const returnUnits = Math.max(
        0,
        Math.floor(Number(item.return_units || 0))
      );

      if (returnUnits > deliveredUnits) {
        alert(
          `تعداد مرجوعی «${item.product_name || "-"}» نمی‌تواند بیشتر از تعداد تحویلی باشد.\n\nتحویلی: ${digits(deliveredUnits)} جزء\nمرجوعی: ${digits(returnUnits)} جزء`
        );
        return;
      }
    }

    if (!confirm("آیا سند مرجوعی ثبت و تأیید نهایی شود؟ پس از ثبت، اطلاعات مبنای مرجوعی دیگر قابل ویرایش نخواهد بود.")) {
      return;
    }

    setSaving(true);

    try {
      /*
       * این همان نقطه ثبت رسمی سند است.
       * از این لحظه وضعیت سند approved می‌شود و اطلاعات اصلی مرجوعی
       * فریز می‌ماند. انبار فقط باید فیلدهای مخصوص دریافت/تعیین تکلیف
       * را روی return_items تغییر دهد و نباید مقدار مرجوعی، قیمت، تخفیف
       * یا مبلغ قابل کسر را تغییر دهد.
       */
      const { data: approvedDocument, error } = await supabase
        .from("return_documents")
        .update({
          status: "approved",
          total_amount: items.reduce(
            (sum, item) =>
              sum +
              Number(item.return_units || 0) *
                Number(item.deduction_unit_price || 0),
            0
          ),
        })
        .eq("id", document.id)
        .eq("status", "pending")
        .select("*")
        .single();

      if (error) throw error;

      setDocument(approvedDocument as ReturnDocument);
      setIsEditing(false);

      alert(
        "سند مرجوعی با موفقیت ثبت و تأیید شد. اطلاعات مبنای سند از این لحظه فریز است و تغییرات انبار روی آن اعمال نخواهد شد."
      );
    } catch (error: any) {
      console.error("RETURN APPROVE ERROR:", error);
      alert(
        `خطا در ثبت نهایی سند مرجوعی: ${
          error?.message || "خطای نامشخص"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  const displayItems = isEditing ? editedItems : items;

  const totalAmount = displayItems.reduce(
    (sum, item) =>
      sum +
      Number(item.return_units || 0) *
        Number(item.deduction_unit_price || 0),
    0
  );

  if (loading) {
    return (
      <AppShell>
        <div style={{ padding: 40, textAlign: "center" }}>
          در حال دریافت جزئیات سند مرجوعی...
        </div>
      </AppShell>
    );
  }

  if (!document) {
    return (
      <AppShell>
        <PageHeader title="جزئیات مرجوعی" />
        <div className="panel" style={{ padding: 40, textAlign: "center" }}>
          سند مرجوعی پیدا نشد.
        </div>
      </AppShell>
    );
  }

  const status = statusInfo(document.status);

  return (
    <AppShell>
      <PageHeader
        title="جزئیات سند مرجوعی"
        subtitle="مشاهده و ویرایش اقلام سند مرجوعی"
        action={
          <button
            className="btn btn-secondary btn-small"
            onClick={() => router.push("/returns/list")}
          >
            <ArrowRight size={14} />
            بازگشت به مرجوعیات
          </button>
        }
      />

      <div className="panel" style={{ marginBottom: 15 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <div className="form-field">
            <label>نوع سند</label>
            <div className="input" style={{ fontWeight: 800 }}>
              مرجوعی
            </div>
          </div>

          <div className="form-field">
            <label>سفارش مبنا</label>
            <div className="input">
              {sourceOrders.length > 0
                ? sourceOrders
                    .map((item) => String(item.order_number || "-"))
                    .join(" - ")
                : order?.order_number
                  ? String(order.order_number)
                  : document.order_id || "-"}
            </div>
          </div>

          <div className="form-field">
            <label>مشتری</label>
            <div className="input">
              {customer?.name || "-"}
            </div>
          </div>

          <div className="form-field">
            <label>تاریخ تحویل سفارش مبنا</label>
            <div className="input">
              {formatDate(order?.delivery_date)}
            </div>
          </div>

          <div className="form-field">
            <label>ویزیتور</label>
            <div className="input">
              {document.visitor || "-"}
            </div>
          </div>

          <div className="form-field">
            <label>تاریخ ثبت سند</label>
            <div className="input">
              {formatDate(document.created_at)}
            </div>
          </div>

          <div className="form-field">
            <label>وضعیت</label>
            <div
              className="input"
              style={{
                background: status.background,
                color: status.color,
                fontWeight: 800,
              }}
            >
              {status.label}
            </div>
          </div>

          <div className="form-field">
            <label>مبلغ کل مرجوعی</label>
            <div className="input" style={{ fontWeight: 800 }}>
              {money(totalAmount)}
            </div>
          </div>
        </div>

        {document.description && (
          <div className="form-field" style={{ marginTop: 14 }}>
            <label>توضیحات</label>
            <div className="input" style={{ minHeight: 65 }}>
              {document.description}
            </div>
          </div>
        )}
      </div>

      <div
        className="panel"
        style={{
          marginBottom: 15,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>عملیات سند</h3>
          {isEditing && (
            <div style={{ marginTop: 5, color: "#64748b", fontSize: 13 }}>
              تعداد مرجوعی را تغییر دهید یا کالا را از سند حذف کنید.
            </div>
          )}
        </div>

        {!isEditing ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {String(document.status || "").toLowerCase() === "pending" && (
              <>
                <button
                  className="btn btn-primary"
                  onClick={startEditing}
                  disabled={saving}
                >
                  ✏️ ویرایش مرجوعی
                </button>

                <button
                  className="btn btn-success"
                  onClick={approveReturnDocument}
                  disabled={saving}
                >
                  {saving ? "در حال ثبت..." : "ثبت نهایی"}
                </button>


<button
  className="btn btn-danger"
  onClick={cancelReturnDocument}
  disabled={saving}
>
  ابطال سند
</button>



              </>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              onClick={saveChanges}
              disabled={saving}
            >
              <Save size={15} />
              {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
            </button>

            <button
              className="btn btn-secondary"
              onClick={cancelEditing}
              disabled={saving}
            >
              <X size={15} />
              لغو ویرایش
            </button>

          </div>
        )}
      </div>

      <div className="panel">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <FileText size={18} />
          <h3 style={{ margin: 0 }}>اقلام مرجوعی</h3>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ردیف</th>
                <th>سفارش مبنا</th>
                <th>تصویر</th>
                <th>بارکد</th>
                <th>نام کالا</th>
                <th>قیمت مصرف‌کننده مبنا</th>
                <th>تخفیف فاکتور مبنا</th>
                <th>مبلغ قابل کسر</th>
                <th>جزء تحویلی</th>
                <th>مرجوعی جزء</th>
                <th>مبلغ مرجوعی</th>
                {isEditing && <th>حذف</th>}
              </tr>
            </thead>

            <tbody>
              {displayItems.map((item, index) => {
                const source = sourceItems.find(
  (sourceItem) =>
    sourceItem.id === item.order_item_id
);
                const deliveredUnits = getDeliveredUnits(source);

                return (
                  <tr key={item.id}>
                    <td>{digits(index + 1)}</td>

                    <td>
                      {sourceOrders.find(
                        (sourceOrder) =>
                          sourceOrder.id === item.source_order_id
                      )?.order_number || "-"}
                    </td>

                    <td>
                      {source?.products?.image_url ? (
                        <img
                          src={source.products.image_url}
                          alt={item.product_name || "product"}
                          style={{
                            width: 48,
                            height: 48,
                            objectFit: "contain",
                            borderRadius: 7,
                            display: "block",
                            margin: "0 auto",
                          }}
                        />
                      ) : (
                        "-"
                      )}
                    </td>

                    <td>{item.barcode || "-"}</td>

                    <td>
                      <strong>{item.product_name || "-"}</strong>
                    </td>

                    <td>{money(item.consumer_price_at_sale)}</td>

                    <td>
                      {digits(Number(item.discount_percent || 0))}٪
                    </td>

                    <td>
                      <strong>
                        {money(item.deduction_unit_price)}
                      </strong>
                    </td>

                    <td>
                      <strong>{digits(deliveredUnits)}</strong>
                    </td>

                    <td style={{ minWidth: 150 }}>
                      {isEditing ? (
                        <div>
                          <input
                            className="input"
                            type="text"
                            inputMode="numeric"
                            value={digits(
                              Number(item.return_units || 0)
                            )}
                            onChange={(event) =>
                              updateReturnUnits(
                                item.id,
                                event.target.value
                              )
                            }
                            style={{ textAlign: "center" }}
                          />

                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 11,
                              color: "#64748b",
                            }}
                          >
                            حداکثر: {digits(deliveredUnits)}
                          </div>
                        </div>
                      ) : (
                        digits(Number(item.return_units || 0))
                      )}
                    </td>

                    <td>
                      {money(
                        Number(item.return_units || 0) *
                          Number(item.deduction_unit_price || 0)
                      )}
                    </td>

                    {isEditing && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          onClick={() => removeItem(item.id)}
                          title="حذف کالا از سند"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}

              {displayItems.length === 0 && (
                <tr>
                  <td
                    colSpan={isEditing ? 11 : 10}
                    style={{
                      padding: 35,
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    هیچ کالایی در سند مرجوعی وجود ندارد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 10,
            background: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <strong>مبلغ کل مرجوعی</strong>
          <strong style={{ fontSize: 18 }}>
            {money(totalAmount)}
          </strong>
        </div>
      </div>
    </AppShell>
  );
}
