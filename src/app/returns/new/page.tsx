"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Search, ArrowRight, Save, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";

function toEnglishDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function digitsOnly(value: string) {
  return toEnglishDigits(value).replace(/[^\d]/g, "");
}

function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function money(value: number | string | null | undefined) {
  const digits = digitsOnly(String(value ?? ""));
  if (!digits) return "۰ ریال";
  return `${toPersianDigits(digits.replace(/\B(?=(\d{3})+(?!\d))/g, ","))} ریال`;
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date);
}

function formatDeliveryDate(value: string | null | undefined) {
  if (!value) return "-";

  const clean = String(value).trim();
  const datePart = clean.split(" ")[0];
  const slashParts = datePart.split("/");

  if (
    slashParts.length === 3 &&
    Number(slashParts[0]) >= 1300 &&
    Number(slashParts[0]) <= 1500
  ) {
    const [year, month, day] = slashParts;
    const months = [
      "فروردین",
      "اردیبهشت",
      "خرداد",
      "تیر",
      "مرداد",
      "شهریور",
      "مهر",
      "آبان",
      "آذر",
      "دی",
      "بهمن",
      "اسفند",
    ];

    return `${toPersianDigits(Number(day))} ${months[Number(month) - 1]} ${toPersianDigits(Number(year))}`;
  }

  const normalized =
    datePart.length === 10 && datePart.includes("-")
      ? `${datePart}T12:00:00`
      : clean;

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return clean;

  const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";

  return `${toPersianDigits(year)}/${toPersianDigits(month)}/${toPersianDigits(day)}`;
}

type Customer = {
  id: string;
  name: string;
  visitor?: string | null;
  customer_group_id?: string | null;
  parent_name?: string | null;
};

type CustomerGroup = {
  id: string;
  name: string;
  primary_customer_id: string;
};

type OrderOption = {
  id: string;
  order_number?: string | number | null;
  customer_id: string;
  customer_name?: string | null;
  status: string;
  created_at: string;
  delivery_date?: string | null;
};

type SnapshotItem = {
  product_id: string;
  selected?: boolean;
  product_name: string;
  barcode?: string | null;
  image_url?: string | null;
  category?: string | null;
  quantity?: number | null;
  final_order_quantity?: number | null;
  consumer_price?: number | null;
  discount_percent?: number | null;
  final_price?: number | null;
  total_purchase_price?: number | null;
  source_order_id?: string;
};

type ReturnRow = SnapshotItem & {
  deliveredCartons: number;
  deliveredUnits: number;
  returnUnits: string;
  cartonSize: number;
  currentDiscount: number;
  deductionUnitPrice: number;
  totalUnits: number;
  totalAmount: number;
};

export default function ReturnsPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showAddOrder, setShowAddOrder] = useState(false);

  const [selectingOrderItems, setSelectingOrderItems] = useState(false);
const [pendingOrderItems, setPendingOrderItems] = useState<SnapshotItem[]>([]);
const [pendingOrderId, setPendingOrderId] = useState("");

  const [addingOrder, setAddingOrder] = useState(false);
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [orderItemSearch, setOrderItemSearch] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [snapshotItems, setSnapshotItems] = useState<SnapshotItem[]>([]);
  const [deliveredQuantities, setDeliveredQuantities] = useState<
    Record<string, { cartons: number; units: number; orderItemId?: string | null; orderId: string }>
  >({});
  const [returnQuantities, setReturnQuantities] = useState<
    Record<string, { units: string }>
  >({});

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [{ data: customerRows, error: customerError }, { data: groupRows, error: groupError }, { data: orderRows, error: orderError }] = await Promise.all([
        supabase
          .from("customers")
          .select("id,name,visitor,customer_group_id")
          .order("name", { ascending: true }),
        supabase
          .from("customer_groups")
          .select("id,name,primary_customer_id"),
        supabase
          .from("orders")
          .select("id,order_number,customer_id,customer_name,status,created_at,delivery_date")
          .in("status", ["approved", "delivered"])
          .order("created_at", { ascending: false }),
      ]);

      if (customerError) throw customerError;
      if (groupError) throw groupError;
      if (orderError) throw orderError;

      const customerRowsTyped = (customerRows || []) as Customer[];
      const groupRowsTyped = (groupRows || []) as CustomerGroup[];

      const groupById = new Map(groupRowsTyped.map((g) => [g.id, g]));
      const parents = customerRowsTyped
        .filter((customer) => {
          if (!customer.customer_group_id) return true;
          const group = groupById.get(customer.customer_group_id);
          return group?.primary_customer_id === customer.id;
        })
        .map((customer) => {
          const group = customer.customer_group_id
            ? groupById.get(customer.customer_group_id)
            : undefined;
          return {
            ...customer,
            name: group?.name || customer.name,
            parent_name: group?.name || null,
          };
        });

      setCustomers(parents);
      setAllCustomers(customerRowsTyped);
      setGroups(groupRowsTyped);
      setOrders((orderRows || []) as OrderOption[]);
    } catch (error: any) {
      console.error("RETURN SAVE ERROR:", error);
      alert(`خطا در دریافت اطلاعات مرجوعی: ${error?.message || "نامشخص"}`);
    } finally {
      setLoading(false);
    }
  }

  const selectedParent = customers.find((item) => item.id === customerId);
  const availableBranches = selectedParent?.customer_group_id
    ? allCustomers.filter(
        (item) =>
          item.customer_group_id === selectedParent.customer_group_id &&
          item.id !== selectedParent.id
      )
    : [];

  const actualCustomerId = selectedParent?.customer_group_id
    ? branchId
    : customerId;

  const customerOrders = useMemo(() => {
    if (!actualCustomerId) return [];
    return orders.filter((order) => order.customer_id === actualCustomerId);
  }, [orders, actualCustomerId]);

  async function loadSnapshot(orderValue: string) {
    setOrderId(orderValue);
    setSelectedOrderIds(orderValue ? [orderValue] : []);
    setSnapshotItems([]);
    setDeliveredQuantities({});
    setReturnQuantities({});

    if (!orderValue) return;

    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from("order_snapshots")
        .select("*")
        .eq("order_id", orderValue)
        .eq("snapshot_type", "official_invoice")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        alert("برای این سفارش نسخه رسمی فاکتور پیدا نشد.");
        return;
      }

      const snapshotItems = Array.isArray(data.items)
        ? (data.items as SnapshotItem[])
        : [];

      const productIds = snapshotItems
        .map((item) => item.product_id)
        .filter(Boolean);

      let productMap = new Map<
        string,
        { barcode?: string | null; image_url?: string | null }
      >();

      if (productIds.length > 0) {
        const { data: productRows, error: productError } = await supabase
          .from("products")
          .select("id,barcode,image_url")
          .in("id", productIds);

        if (productError) {
          console.error("PRODUCT DATA ERROR:", productError);
        } else {
          productMap = new Map(
            (productRows || []).map((product) => [
              String(product.id),
              {
                barcode: product.barcode ?? null,
                image_url: product.image_url ?? null,
              },
            ])
          );
        }
      }

      const items = snapshotItems.map((item) => {
        const product = productMap.get(String(item.product_id));

        return {
          ...item,
          barcode: item.barcode || product?.barcode || null,
          image_url: item.image_url || product?.image_url || null,
        };
      });

      setPendingOrderItems(
 items.map((item)=>({
   ...item,
   source_order_id: orderValue,
   selected:false
 }))
);

setPendingOrderId(orderValue);
setSelectingOrderItems(true);

      // تعداد تحویلی، مقدار عملیاتی انبار است و از order_items خوانده می‌شود.
      // اطلاعات رسمی فاکتور همچنان از Snapshot می‌آید و دست‌نخورده می‌ماند.
      const { data: deliveryRows, error: deliveryError } = await supabase
        .from("order_items")
        .select("id,product_id,delivery_cartons,delivery_units")
        .eq("order_id", orderValue);

      if (deliveryError) {
        console.error("DELIVERY DATA ERROR:", {
          message: deliveryError.message,
          details: deliveryError.details,
          hint: deliveryError.hint,
          code: deliveryError.code,
          orderId: orderValue,
        });
      }

      const deliveryMap: Record<string, { cartons: number; units: number; orderItemId?: string | null; orderId: string }> = {};

      (deliveryRows || []).forEach((row: any) => {
        deliveryMap[`${orderValue}:${String(row.product_id)}`] = {
          cartons: Math.max(Number(row.delivery_cartons || 0), 0),
          units: Math.max(Number(row.delivery_units || 0), 0),
          orderItemId: row.id || null,
          orderId: orderValue,
        };
      });

      setDeliveredQuantities((previous) => ({ ...previous, ...deliveryMap }));
    
    setPendingOrderItems(
  items.map((item)=>({
    ...item,
    selected:false,
  }))
);

setPendingOrderId(orderValue);
setSelectingOrderItems(true);
    
    } catch (error: any) {
      console.error("RETURN SAVE ERROR:", error);
      alert(`خطا در دریافت نسخه رسمی فاکتور: ${error?.message || "نامشخص"}`);
    } finally {
      setLoadingItems(false);
    }
  }

  function itemKey(item: SnapshotItem) {
    return `${item.source_order_id || orderId}:${item.product_id}`;
  }

  function updateReturnQuantity(
    productId: string,
    value: string,
    sourceOrderId?: string
  ) {
    const key = `${sourceOrderId || orderId}:${productId}`;
    const clean = digitsOnly(value);
    const deliveredUnits = Math.max(
      0,
      Number(deliveredQuantities[key]?.units || 0)
    );

    const requestedUnits = Number(clean || 0);
    const safeUnits = Math.min(
      Math.max(Number.isFinite(requestedUnits) ? requestedUnits : 0, 0),
      deliveredUnits
    );

    setReturnQuantities((previous) => ({
      ...previous,
      [key]: {
        units: clean === "" ? "" : String(safeUnits),
      },
    }));
  }

  function getCartonSize(item: SnapshotItem) {
    const orderQuantity = Number(item.quantity || 0);
    const finalQuantity = Number(item.final_order_quantity || 0);
    const base = finalQuantity > 0 ? orderQuantity / finalQuantity : 1;
    return Math.max(Math.round(base) || 1, 1);
  }

  const rows: ReturnRow[] = useMemo(() => {
    return snapshotItems.map((item) => {
      const quantity = returnQuantities[itemKey(item)] || {
        units: "",
      };
      const cartonSize = getCartonSize(item);
      const delivered = deliveredQuantities[itemKey(item)] || {
        cartons: 0,
        units: 0,
      };
      const requestedUnits = Number(quantity.units || 0);
      const units = Math.min(
        Math.max(Number.isFinite(requestedUnits) ? requestedUnits : 0, 0),
        Math.max(Number(delivered.units || 0), 0)
      );
      const totalUnits = units;
      const consumerPrice = Number(item.consumer_price || 0);
      const invoiceDiscount = Number(item.discount_percent || 0);
      const deductionUnitPrice = Math.round(
        consumerPrice - (consumerPrice * invoiceDiscount) / 100
      );

      return {
        ...item,
        deliveredCartons: delivered.cartons,
        deliveredUnits: delivered.units,
        returnUnits: quantity.units,
        cartonSize,
        currentDiscount: invoiceDiscount,
        deductionUnitPrice,
        totalUnits,
        totalAmount: totalUnits * deductionUnitPrice,
      };
    });
  }, [snapshotItems, returnQuantities, deliveredQuantities]);

  const filteredRows = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [row.product_name, row.barcode, row.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const selectedRows = rows.filter((row) => row.totalUnits > 0);
  const totalReturnAmount = selectedRows.reduce(
    (sum, row) => sum + row.totalAmount,
    0
  );

  const selectedOrder = orders.find((order) => order.id === orderId);

  async function addSourceOrder(sourceOrderId: string) {
    if (!sourceOrderId) {
  setShowAddOrder(false);
  return;
}

    setAddingOrder(true);
    try {
     

if (selectedOrderIds.length === 0) {
  await loadSnapshot(sourceOrderId);

  setSelectedOrderIds([sourceOrderId]);
} else {

  setSelectedOrderIds((previous) => [
    ...previous,
    sourceOrderId
  ]);

  await loadAdditionalSnapshot(sourceOrderId);

}
// فعلاً نبند
// چون پنجره انتخاب کالا باید باز بماند
    } finally {
      setAddingOrder(false);
    }
  }

  async function loadAdditionalSnapshot(orderValue: string) {
    const { data, error } = await supabase
      .from("order_snapshots")
      .select("*")
      .eq("order_id", orderValue)
      .eq("snapshot_type", "official_invoice")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      alert("برای این سفارش نسخه رسمی فاکتور پیدا نشد.");
      return;
    }

    const rawItems = Array.isArray(data.items) ? (data.items as SnapshotItem[]) : [];
    const productIds = rawItems.map((item) => item.product_id).filter(Boolean);
    let productMap = new Map<string, { barcode?: string | null; image_url?: string | null }>();

    if (productIds.length > 0) {
      const { data: productRows } = await supabase
        .from("products")
        .select("id,barcode,image_url")
        .in("id", productIds);
      productMap = new Map((productRows || []).map((product: any) => [String(product.id), { barcode: product.barcode ?? null, image_url: product.image_url ?? null }]));
    }

    const items = rawItems.map((item) => ({
      ...item,
      source_order_id: orderValue,
      barcode: item.barcode || productMap.get(String(item.product_id))?.barcode || null,
      image_url: item.image_url || productMap.get(String(item.product_id))?.image_url || null,
    }));

   

    const { data: deliveryRows, error: deliveryError } = await supabase
      .from("order_items")
      .select("id,product_id,delivery_cartons,delivery_units")
      .eq("order_id", orderValue);
    if (deliveryError) throw deliveryError;

    const deliveryMap: Record<string, { cartons: number; units: number; orderItemId?: string | null; orderId: string }> = {};
    (deliveryRows || []).forEach((row: any) => {
      deliveryMap[`${orderValue}:${String(row.product_id)}`] = {
        cartons: Math.max(Number(row.delivery_cartons || 0), 0),
        units: Math.max(Number(row.delivery_units || 0), 0),
        orderItemId: row.id || null,
        orderId: orderValue,
      };
    });
    setDeliveredQuantities((previous) => ({
  ...previous,
  ...deliveryMap
}));

setPendingOrderItems(
  items.map((item) => ({
    ...item,
    selected: false,
  }))
);

setPendingOrderId(orderValue);

setSelectingOrderItems(true);
  }


function confirmAddSelectedItems() {
  const selected = pendingOrderItems.filter(
    (item) => item.selected
  );

  if (selected.length === 0) {
    alert("حداقل یک کالا انتخاب کنید.");
    return;
  }

  setSnapshotItems((previous) => [
    ...previous,
    ...selected.map((item) => ({
      ...item,
       source_order_id: pendingOrderId || orderId,
    })),
  ]);

  setSelectingOrderItems(false);
setShowAddOrder(false);
  setPendingOrderItems([]);
  setPendingOrderId("");
}




function removeReturnItem(item: SnapshotItem) {
  const key = itemKey(item);

  setSnapshotItems((previous) =>
    previous.filter((row) => itemKey(row) !== key)
  );

  setReturnQuantities((previous) => {
    const next = { ...previous };
    delete next[key];
    return next;
  });
}



  function removeSourceOrder(sourceOrderId: string) {
    
    setSelectedOrderIds((previous) => previous.filter((id) => id !== sourceOrderId));
    setSnapshotItems((previous) => previous.filter((item) => item.source_order_id !== sourceOrderId));
    setDeliveredQuantities((previous) => {
      const next = { ...previous };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${sourceOrderId}:`)) delete next[key];
      });
      return next;
    });
    setReturnQuantities((previous) => {
      const next = { ...previous };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${sourceOrderId}:`)) delete next[key];
      });
      return next;
    });
  }

  function handleDocumentFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    const allowed = files.filter(
      (file) =>
        file.type === "application/pdf" ||
        file.type.startsWith("image/")
    );

    if (allowed.length !== files.length) {
      alert("فقط فایل PDF و تصویر قابل انتخاب است.");
    }

    setSelectedDocuments((previous) => [...previous, ...allowed]);
    event.target.value = "";
  }

  function resetForm() {
    setCustomerId("");
    setBranchId("");
    setOrderId("");
    setSelectedOrderIds([]);
    setShowAddOrder(false);
    setDescription("");
    setSearch("");
    setSnapshotItems([]);
    setReturnQuantities({});
    setSelectedDocuments([]);
  }

  async function saveReturn() {
    if (!customerId) {
      alert("لطفاً مجموعه / مشتری را انتخاب کنید.");
      return;
    }

    if (selectedParent?.customer_group_id && !branchId) {
      alert("این مشتری یک مجموعه است. ابتدا شعبه را انتخاب کنید.");
      return;
    }

    if (!orderId) {
      alert("لطفاً سفارش مربوط به مرجوعی را انتخاب کنید.");
      return;
    }

    if (selectedRows.length === 0) {
      alert("حداقل یک کالا برای مرجوعی انتخاب کنید.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_id: actualCustomerId,
        order_id: orderId,
        visitor:
          allCustomers.find((customer) => customer.id === actualCustomerId)?.visitor ||
          selectedParent?.visitor ||
          null,
        status: "pending",
        total_amount: totalReturnAmount,
        description: description || null,
      };

      const { data: returnDocument, error: returnError } = await supabase
        .from("return_documents")
        .insert(payload)
        .select("*")
        .single();

      if (returnError) throw returnError;



      console.log("SELECTED ROWS BEFORE SAVE", selectedRows);
      const itemPayload = selectedRows.map((row) => ({
        return_id: returnDocument.id,
        product_id: row.product_id,
        source_order_id: row.source_order_id || null,
        product_name: row.product_name,
        barcode: row.barcode || null,
        category: row.category || null,
        order_item_id: deliveredQuantities[itemKey(row)]?.orderItemId || null,
        quantity_per_carton: row.cartonSize,
        return_cartons: 0,
        return_units: Number(row.returnUnits || 0),
        return_total_units: row.totalUnits,
        consumer_price_at_sale: Number(row.consumer_price || 0),
        discount_percent: Number(row.currentDiscount || 0),
        deduction_unit_price: row.deductionUnitPrice,
        total_return_amount: row.totalAmount,
        warehouse_received_units: 0,
        resalable_units: 0,
        destroyed_units: 0,
        warehouse_disposition: null,
      }));

      const { error: itemsError } = await supabase
        .from("return_items")
        .insert(itemPayload);

      if (itemsError) {
        await supabase.from("return_documents").delete().eq("id", returnDocument.id);
        throw itemsError;
      }

      alert("سند مرجوعی با موفقیت ثبت شد و در انتظار تأیید قرار گرفت.");

router.push("/returns");
    } catch (error: any) {
      console.error("RETURN SAVE ERROR:", error);
      alert(`خطا در ثبت سند مرجوعی: ${error?.message || "نامشخص"}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div style={{ padding: 40, textAlign: "center" }}>
          در حال دریافت اطلاعات مرجوعی...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="مرجوعی کالا"
        subtitle="ثبت، بررسی و مدیریت اسناد مرجوعی مشتریان"
        action={
          <button
            className="btn btn-secondary btn-small"
            onClick={() => router.push("/orders")}
          >
            <ArrowRight size={14} />
            بازگشت
          </button>
        }
      />

      <div className="panel" style={{ marginBottom: 15 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          <div className="form-field">
            <label>مجموعه / مشتری</label>
            <select
              className="input"
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                setBranchId("");
                setOrderId("");
                setSelectedOrderIds([]);
                setShowAddOrder(false);
                setSnapshotItems([]);
                setReturnQuantities({});
              }}
            >
              <option value="">انتخاب مجموعه / مشتری</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          {selectedParent?.customer_group_id ? (
            <div className="form-field">
              <label>شعبه واقعی</label>
              <select
                className="input"
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setOrderId("");
                  setSnapshotItems([]);
                  setReturnQuantities({});
                }}
              >
                <option value="">انتخاب شعبه</option>
                {availableBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div />
          )}

          
        </div>


      <div
  style={{
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  }}
>
  <button
    type="button"
    className="btn btn-primary btn-small"
    onClick={() => setShowAddOrder(true)}
    disabled={!actualCustomerId || addingOrder || saving}
  >
    <Plus size={14} />
    سفارش مبنا
  </button>
</div>
      
        {selectedOrderIds.length > 0 && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "flex",
              gap: 10,
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <strong>سفارش‌های مبنای انتخاب‌شده:</strong>
              
            </div>
            {selectedOrderIds.map((id, index) => {
              const sourceOrder = orders.find((order) => order.id === id);
              if (!sourceOrder) return null;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span>
                    {toPersianDigits(index + 1)}. سفارش {sourceOrder.order_number || "-"} — تحویل: {formatDeliveryDate(sourceOrder.delivery_date)}
                  </span>
                  {(
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => removeSourceOrder(id)}
                      disabled={saving}
                    >
                      حذف سفارش
                    </button>
                  )}
                </div>
              );
            })}
            <span style={{ color: "#047857", fontWeight: 800 }}>
              قیمت مصرف‌کننده و تخفیف هر کالا از نسخه رسمی همان سفارش خوانده می‌شود.
            </span>
          </div>
        )}
      </div>

        {showAddOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.45)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >



          {selectingOrderItems && (
<div
style={{
position:"fixed",
inset:0,
background:"rgba(0,0,0,.4)",
zIndex:3000,
display:"flex",
justifyContent:"center",
alignItems:"center",
}}
>
<div
style={{
width:"90%",
maxWidth:"1100px",
height:"75%",
borderRadius:14,
background:"#fff",
padding:20,
overflow:"auto"
}}
>

<h3>انتخاب کالا از سفارش مبنا</h3>
<input
 className="input"
 placeholder="جستجو بر اساس بارکد یا نام کالا..."
 value={orderItemSearch}
 onChange={(e)=>setOrderItemSearch(e.target.value)}
 style={{marginBottom:15}}
/>
<div className="table-wrap">
<table>
<thead>
<tr>
<th>انتخاب</th>
<th>تصویر</th>
<th>بارکد</th>
<th>نام کالا</th>
<th>قیمت مصرف‌کننده</th>
<th>تعداد تحویلی</th>
</tr>
</thead>

<tbody>

{pendingOrderItems
.filter((item)=>{
 const q = orderItemSearch.trim().toLowerCase();

 if(!q) return true;

 return [
   item.product_name,
   item.barcode,
 ].filter(Boolean)
 .join(" ")
 .toLowerCase()
 .includes(q);

})
.map((item,index)=>{

const delivered =
deliveredQuantities[
`${pendingOrderId}:${item.product_id}`
]?.units || 0;

return (

<tr key={`${item.product_id}-${index}`}>

<td>

<input
type="checkbox"
checked={!!item.selected}
onChange={()=>{

setPendingOrderItems(prev =>
prev.map((x,i)=>
i===index
?
{
...x,
selected:!x.selected
}
:
x
)
)

}}
/>

</td>


<td>

{
item.image_url ?

<img
src={item.image_url}
alt={item.product_name}
style={{
width:45,
height:45,
objectFit:"contain",
borderRadius:8
}}
/>

:

"-"

}

</td>


<td>
{item.barcode || "-"}
</td>


<td>
<strong>
{item.product_name}
</strong>
</td>


<td>
{money(item.consumer_price)}
</td>


<td>
{toPersianDigits(delivered)}
</td>


</tr>

)

})}

</tbody>

</table>
</div>


<button
className="btn btn-primary"
onClick={confirmAddSelectedItems}
>
افزودن کالاهای انتخاب شده
</button>


</div>
</div>
)}
          <div
            style={{
              width: "100%",
              maxWidth: 620,
              background: "#fff",
              borderRadius: 14,
              padding: 20,
              boxShadow: "0 20px 60px rgba(15,23,42,.2)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>افزودن سفارش مبنا</h3>
            <p style={{ color: "#64748b", fontSize: 13 }}>
              فقط سفارش‌های همین مشتری که هنوز به سند اضافه نشده‌اند نمایش داده می‌شوند.
            </p>
            <select
              className="input"
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value;
                if (value) void addSourceOrder(value).catch((error) => alert(`خطا در افزودن سفارش: ${error?.message || "نامشخص"}`));
              }}
              disabled={addingOrder}
            >
              <option value="">انتخاب سفارش دیگر</option>
              {customerOrders
                .filter((order) => !selectedOrderIds.includes(order.id))
                .map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.order_number ? `سفارش ${order.order_number}` : "سفارش"} — تحویل: {formatDeliveryDate(order.delivery_date)}
                  </option>
                ))}
            </select>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddOrder(false)} disabled={addingOrder}>
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="form-field" style={{ marginTop: 14 }}>
          <label>توضیحات مرجوعی</label>
          <textarea
            className="input"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="توضیحات مربوط به سند مرجوعی..."
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            gap: 10,
            marginTop: 15,
          }}
        >
          <input
            id="return-documents-input"
            type="file"
            accept="application/pdf,image/*"
            multiple
            onChange={handleDocumentFilesChange}
            style={{ display: "none" }}
          />

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              document.getElementById("return-documents-input")?.click()
            }
            disabled={saving}
          >
            📎 آپلود مستندات
          </button>

          {selectedDocuments.length > 0 && (
            <span style={{ fontSize: 13, color: "#475569" }}>
              {selectedDocuments.length.toLocaleString("fa-IR")} فایل انتخاب شده
            </span>
          )}

          <button
            className="btn btn-primary"
            onClick={saveReturn}
            disabled={saving || loadingItems}
          >
            <Save size={15} />
            {saving ? "در حال ثبت..." : "ثبت سند مرجوعی"}
          </button>
          <button className="btn btn-secondary" onClick={resetForm} disabled={saving}>
            پاک کردن فرم
          </button>
        </div>

        {selectedDocuments.length > 0 && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {selectedDocuments.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {file.type === "application/pdf" ? "📄" : "🖼️"} {file.name}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() =>
                    setSelectedDocuments((previous) =>
                      previous.filter((_, fileIndex) => fileIndex !== index)
                    )
                  }
                  disabled={saving}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}

      <div className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 15,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>اقلام مرجوعی</h3>
            <div style={{ marginTop: 5, color: "#64748b", fontSize: 13 }}>
              قیمت مصرف‌کننده و درصد تخفیف مستقیماً از همان فاکتور مبنا خوانده و داخل سند مرجوعی فریز می‌شوند.
            </div>
          </div>

          <div style={{ position: "relative", width: 320, maxWidth: "100%" }}>
            <Search
              size={17}
              style={{ position: "absolute", right: 12, top: 12, color: "#94a3b8" }}
            />
            <input
              className="input"
              style={{ paddingRight: 40 }}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی کالا، بارکد یا گروه..."
            />
          </div>
        </div>

        {loadingItems ? (
          <div style={{ padding: 35, textAlign: "center" }}>
            در حال دریافت نسخه رسمی فاکتور...
          </div>
        ) : !orderId ? (
          <div style={{ padding: 35, textAlign: "center", color: "#64748b" }}>
            ابتدا مشتری و سفارش مبنا را انتخاب کنید.
          </div>
        ) : snapshotItems.length === 0 ? (
          <div style={{ padding: 35, textAlign: "center", color: "#b91c1c" }}>
            برای این سفارش اقلام نسخه رسمی فاکتور پیدا نشد.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>حذف</th>
                  <th>ردیف</th>
                  <th>تصویر</th>
                  <th>بارکد</th>
                  <th>نام کالا</th>
                  <th>سفارش مبنا</th>
                  <th>قیمت مصرف‌کننده مبنا</th>
                  <th>تخفیف فاکتور مبنا</th>
                  <th>مبلغ قابل کسر</th>
                  <th>جزء تحویلی</th>
                  <th>مرجوعی جزء</th>
                  <th>مبلغ مرجوعی</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={itemKey(row)}>
                    <td>
  <button
    type="button"
    className="btn btn-secondary btn-small"
    onClick={() => removeReturnItem(row)}
    style={{
      color: "#dc2626",
      borderColor: "#fecaca",
      padding: "5px 8px"
    }}
    title="حذف کالا از مرجوعی"
  >
    <Trash2 size={16} />
  </button>
</td>
                    <td>{toPersianDigits(index + 1)}</td>
                    <td>
                      {row.image_url ? (
                        <img
                          src={row.image_url}
                          alt={row.product_name}
                          style={{
                            width: 44,
                            height: 44,
                            objectFit: "contain",
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            background: "#ffffff",
                            display: "block",
                            margin: "0 auto",
                          }}
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{row.barcode || "-"}</td>
                    <td><strong>{row.product_name}</strong></td>
                    <td>
  {
    orders.find(
      (o) => o.id === row.source_order_id
    )?.order_number || "-"
  }
</td>
                    <td>{money(row.consumer_price)}</td>
                    <td>
                      <strong>{toPersianDigits(row.currentDiscount)}٪</strong>
                    </td>
                    <td><strong>{money(row.deductionUnitPrice)}</strong></td>
                    <td>{toPersianDigits(row.deliveredUnits)}</td>
                    <td style={{ minWidth: 115 }}>
                      <input
                        className="input"
                        type="text"
                        inputMode="numeric"
                        value={row.returnUnits ? toPersianDigits(row.returnUnits) : ""}
                        onChange={(event) =>
                          updateReturnQuantity(row.product_id, event.target.value, row.source_order_id)
                        }
                        placeholder="جزء"
                      />
                    </td>
                    <td>
                      {row.totalUnits > 0 ? money(row.totalAmount) : "-"}
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: 30, textAlign: "center" }}>
                      کالایی پیدا نشد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            padding: 18,
            borderRadius: 12,
            background: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 15,
            flexWrap: "wrap",
          }}
        >
          <div>
            <span style={{ color: "#64748b" }}>مبلغ کل مرجوعی:</span>
            <strong style={{ marginRight: 8, fontSize: 18 }}>
              {money(totalReturnAmount)}
            </strong>
          </div>
          <div>
            <span style={{ color: "#64748b" }}>وضعیت سند:</span>
            <strong style={{ marginRight: 8, color: "#b45309" }}>در انتظار تأیید</strong>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
