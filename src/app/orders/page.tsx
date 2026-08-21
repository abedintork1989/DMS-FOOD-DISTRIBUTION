"use client";


import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  RotateCcw,
} from "lucide-react";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import DataTable, { DataTableColumn } from "@/components/DataTable/DataTable";
import { supabase } from "@/lib/supabase";

type Customer = {
  id: string;
  name: string;
  province?: string | null;
  visitor?: string | null;
  customer_group_id?: string | null;
  primary_customer_id?: string | null;
  parent_name?: string | null;
};

type Product = {
  id: string;
  name: string;
  category: string | null;
  barcode: string | null;
  unit: string | null;
  quantity_per_carton: number | null;
  consumer_price: number | null;
  inventory: number | null;
};

type CustomerDiscount = {
  category: string;
  discount_percent: number;
};

type OrderItem = {
  id?: string;
  product_id?: string;
  quantity?: number;

  productId?: string;
  productName?: string;
  barcode?: string;
  category?: string;

  cartonSize?: number;
  orderCartons?: number;
  orderUnits?: number;
  totalUnits?: number;

  consumerPrice?: number;
  discountPercent?: number;
  finalPurchasePrice?: number;

  total?: number;

  products?: {
    name: string;
    barcode: string | null;
    category: string | null;
    quantity_per_carton: number | null;
  };
};

type Order = {
  id: string;
  order_number?: string | number | null;
  customer_id: string;
  customer_name?: string;
  visitor?: string | null;
  status: string;
  invoice_total?: number;
  created_at: string;
  send_date?: string | null;
  delivery_date?: string | null;
  branch_name?: string | null;

  customers?: {
    name: string;
    province?: string | null;
    visitor: string | null;
    customer_group_id?: string | null;
    parent_name?: string | null;
  };

  order_items?: OrderItem[];
};

const emptyQuantities: Record<
  string,
  {
    cartons: string;
    units: string;
  }
> = {};

/* ------------------------------------------------ */
/* ابزارهای عدد فارسی */
/* ------------------------------------------------ */

function toEnglishDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function toPersianDigits(value: string | number) {
  return String(value)
    .replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function digitsOnly(value: string) {
  return toEnglishDigits(value).replace(/[^\d]/g, "");
}

function formatNumber(value: number | string | null | undefined) {
  const digits = digitsOnly(String(value ?? ""));

  if (!digits) {
    return "۰";
  }

  return toPersianDigits(
    digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  );
}

function money(value: number | string | null | undefined) {
  return `${formatNumber(value)} ریال`;
}

function formatDate(value: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

/* ------------------------------------------------ */
/* وضعیت سفارش */
/* ------------------------------------------------ */

function statusInfo(status: string) {
  switch (status) {
    case "pending":
      return {
        label: "در انتظار تایید",
        className: "warning",
      };

    case "approved":
      return {
        label: "تایید شده",
        className: "success",
      };

    case "delivered":
      return {
        label: "تحویل شده",
        className: "info",
      };

    case "cancelled":
      return {
        label: "باطل شده",
        className: "danger",
      };

    default:
      return {
        label: status,
        className: "warning",
      };
  }
}

/* ------------------------------------------------ */
/* صفحه */
/* ------------------------------------------------ */

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  type OrderSnapshot = {
    id: string;
    order_id: string;
    invoice_total?: number | null;
    send_date?: string | null;
    snapshot_type?: string | null;
    created_at?: string | null;
  };

  const [orderSnapshots, setOrderSnapshots] = useState<OrderSnapshot[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<CustomerDiscount[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ------------------------------------------------ */
  /* فیلتر و جستجوی ستونی لیست سفارشات */
  /* ------------------------------------------------ */

  type OrderFilterKey =
    | "customer"
    | "branch"
    | "province"
    | "visitor"
    | "status"
    | "createdAt"
    | "sendDate"
    | "invoiceTotal";

  const [orderFilterSelections, setOrderFilterSelections] = useState<
    Record<OrderFilterKey, string[]>
  >({
    customer: [],
    branch: [],
    province: [],
    visitor: [],
    status: [],
    createdAt: [],
    sendDate: [],
    invoiceTotal: [],
  });

  const [openOrderFilter, setOpenOrderFilter] =
    useState<OrderFilterKey | null>(null);
  const [orderFilterSearch, setOrderFilterSearch] = useState("");
  const [orderSortKey, setOrderSortKey] = useState<OrderFilterKey | null>(null);
  const [orderSortDirection, setOrderSortDirection] = useState<"asc" | "desc">(
    "asc"
  );

  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchCustomers, setBranchCustomers] = useState<Customer[]>([]);
  const [visitor, setVisitor] = useState("");

  const [search, setSearch] = useState("");

  const [quantities, setQuantities] =
    useState<Record<string, { cartons: string; units: string }>>(
      emptyQuantities
    );

  const router = useRouter();

  /* ------------------------------------------------ */
  /* دریافت اطلاعات اولیه */
  /* ------------------------------------------------ */

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);

    await Promise.all([
      loadCustomers(),
      loadProducts(),
      loadOrders(),
      loadOrderSnapshots(),
    ]);

    setLoading(false);
  }

  async function loadOrderSnapshots() {
    const { data, error } = await supabase
      .from("order_snapshots")
      .select("id,order_id,invoice_total,send_date,snapshot_type,created_at")
      .eq("snapshot_type", "official_invoice")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("ORDER SNAPSHOTS LOAD WARNING:", error.message);
      setOrderSnapshots([]);
      return;
    }

    setOrderSnapshots((data || []) as OrderSnapshot[]);
  }

  async function loadCustomers() {
    const [
      { data: customerRows, error: customerError },
      { data: groupRows, error: groupError },
    ] = await Promise.all([
      supabase
        .from("customers")
        .select("id,name,province,visitor,customer_group_id")
        .order("name", { ascending: true }),

      supabase
        .from("customer_groups")
        .select("id,name,primary_customer_id"),
    ]);

    if (customerError) {
      console.error(customerError);
      alert(`خطا در دریافت مشتریان: ${customerError.message}`);
      return;
    }

    if (groupError) {
      console.error(groupError);
      alert(`خطا در دریافت مجموعه مشتریان: ${groupError.message}`);
      return;
    }

    const groups = (groupRows || []) as Array<{
      id: string;
      name: string;
      primary_customer_id: string;
    }>;

    const customerRowsTyped = (customerRows || []) as Customer[];

    const parentByGroupId = new Map(
      groups.map((group) => [
        group.id,
        group,
      ])
    );

    // در ثبت سفارش فقط نام مجموعه / مشتری مادر در لیست اول نمایش داده می‌شود.
    const parents = customerRowsTyped
      .filter((customer) => {
        if (!customer.customer_group_id) return true;

        const group = parentByGroupId.get(customer.customer_group_id);
        return group?.primary_customer_id === customer.id;
      })
      .map((customer) => {
        const group = customer.customer_group_id
          ? parentByGroupId.get(customer.customer_group_id)
          : undefined;

        return {
          ...customer,
          name: group?.name || customer.name,
          primary_customer_id: group?.primary_customer_id || customer.id,
        };
      });

    setCustomers(parents);

    // شعبه‌ها برای انتخاب بعد از انتخاب مجموعه نگه داشته می‌شوند.
    setBranchCustomers(customerRowsTyped);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        category,
        barcode,
        unit,
        quantity_per_carton,
        consumer_price,
        inventory
        `
      )
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      alert(`خطا در دریافت کالاها: ${error.message}`);
      return;
    }

    setProducts((data || []) as Product[]);
  }

  async function loadOrders() {
    const { data, error } = await supabase
.from("orders")
.select(`
  *,
  customers(
    name,
    province,
    visitor
  ),
  order_items(
    *,
    products(
      name,
      barcode,
      category,
      quantity_per_carton
    )
  )
`)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      alert(`خطا در دریافت سفارشات: ${error.message}`);
      return;
    }

    const { data: groupRows } = await supabase
      .from("customer_groups")
      .select("id,name,primary_customer_id");

    const { data: allCustomers } = await supabase
      .from("customers")
      .select("id,name,customer_group_id");

    const groups = (groupRows || []) as Array<{
      id: string;
      name: string;
      primary_customer_id: string;
    }>;

    const customerMap = new Map(
      (allCustomers || []).map((customer: any) => [
        customer.id,
        customer,
      ])
    );

    const groupMap = new Map(
      groups.map((group) => [group.id, group])
    );

    const normalizedOrders = (data || []).map((order: any) => {
      const customer = customerMap.get(order.customer_id);
      const group = customer?.customer_group_id
        ? groupMap.get(customer.customer_group_id)
        : undefined;

      return {
        ...order,
        customers: {
          ...(order.customers || {}),
          parent_name: group?.name || order.customers?.name || order.customer_name,
          customer_group_id: customer?.customer_group_id || null,
        },
        branch_name:
          group && group.primary_customer_id !== order.customer_id
            ? order.customers?.name || order.customer_name || "-"
            : "-",
      };
    });

    setOrders(normalizedOrders as Order[]);
  }

  /* ------------------------------------------------ */
  /* دریافت تخفیف مشتری */
  /* ------------------------------------------------ */

  async function loadCustomerDiscounts(id: string) {
    if (!id) {
      setDiscounts([]);
      return;
    }

    const { data, error } = await supabase
      .from("customer_group_discounts")
      .select("category,discount_percent")
      .eq("customer_id", id);

    if (error) {
      console.error(error);
      alert(`خطا در دریافت تخفیف‌های مشتری: ${error.message}`);
      setDiscounts([]);
      return;
    }

    setDiscounts((data || []) as CustomerDiscount[]);
  }

  function getDiscountForCategory(category: string | null) {
    if (!category) return 0;

    const item = discounts.find(
      (discount) =>
        discount.category.trim() === category.trim()
    );

    return Number(item?.discount_percent || 0);
  }

  /* ------------------------------------------------ */
  /* انتخاب مشتری */
/* ------------------------------------------------ */

  async function handleCustomerChange(id: string) {
    setCustomerId(id);
    setBranchId("");

    const customer = customers.find(
      (item) => item.id === id
    );

    setVisitor(customer?.visitor || "");

    const groupId = customer?.customer_group_id || null;

    const branches = groupId
      ? branchCustomers.filter(
          (item) =>
            item.customer_group_id === groupId &&
            item.id !== customer?.id
        )
      : [];

    setBranchCustomers((previous) => previous);

    if (branches.length > 0) {
      setBranchId("");
    }

    await loadCustomerDiscounts(id);
  }

  /* ------------------------------------------------ */
  /* قیمت نهایی */
/* ------------------------------------------------ */

  function getFinalPrice(product: Product) {
    const consumerPrice = Number(
      product.consumer_price || 0
    );

    const discountPercent = getDiscountForCategory(
      product.category
    );

    return Math.round(
      consumerPrice -
        (consumerPrice * discountPercent) / 100
    );
  }

  /* ------------------------------------------------ */
  /* تعداد کالا */
/* ------------------------------------------------ */

  function getQuantity(productId: string) {
    return (
      quantities[productId] || {
        cartons: "",
        units: "",
      }
    );
  }

  function updateQuantity(
    productId: string,
    field: "cartons" | "units",
    value: string
  ) {
    const clean = digitsOnly(value);

    setQuantities((previous) => ({
      ...previous,
      [productId]: {
        ...(previous[productId] || {
          cartons: "",
          units: "",
        }),
        [field]: clean,
      },
    }));
  }

  /* ------------------------------------------------ */
  /* محاسبه آیتم‌ها */
/* ------------------------------------------------ */

  const orderItems = useMemo(() => {
    const result: OrderItem[] = [];

    for (const product of products) {
      const quantity = getQuantity(product.id);

      const cartons = Number(quantity.cartons || 0);
      const units = Number(quantity.units || 0);

      if (cartons === 0 && units === 0) {
        continue;
      }

      const cartonSize = Math.max(
        Number(product.quantity_per_carton || 1),
        1
      );

      const totalUnits =
        cartons * cartonSize + units;

      const consumerPrice = Number(
        product.consumer_price || 0
      );

      const discountPercent =
        getDiscountForCategory(product.category);

      const finalPurchasePrice =
        Math.round(
          consumerPrice -
            (consumerPrice * discountPercent) / 100
        );

      const total =
        totalUnits * finalPurchasePrice;

      result.push({
        productId: product.id,
        productName: product.name,
        barcode: product.barcode || "-",
        category: product.category || "-",
        cartonSize,
        orderCartons: cartons,
        orderUnits: units,
        totalUnits,
        consumerPrice,
        discountPercent,
        finalPurchasePrice,
        total,
      });
    }

    return result;
  }, [products, quantities, discounts]);

  const orderTotal = useMemo(() => {
    return orderItems.reduce(
      (sum, item) => sum + (item.total || 0),
      0
    );
  }, [orderItems]);

  /* ------------------------------------------------ */
  /* فیلتر کالا */
/* ------------------------------------------------ */

  const filteredProducts = products.filter((product) => {
    const q = search.trim().toLowerCase();

    if (!q) return true;

    return [
      product.name,
      product.category,
      product.barcode,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  /* ------------------------------------------------ */
  /* باز کردن ثبت سفارش */
/* ------------------------------------------------ */

  function openOrderModal() {
    setCustomerId("");
    setBranchId("");
    setVisitor("");
    setDiscounts([]);
    setSearch("");
    setQuantities({});
    setModal(true);
  }

  function closeOrderModal() {
    if (saving) return;

    setModal(false);
    setCustomerId("");
    setBranchId("");
    setVisitor("");
    setDiscounts([]);
    setSearch("");
    setQuantities({});
  }

  /* ------------------------------------------------ */
  /* ثبت سفارش */
/* ------------------------------------------------ */

  async function createOrder() {
    if (!customerId) {
      alert("لطفاً مشتری را انتخاب کنید.");
      return;
    }

    if (!orderItems.length) {
      alert("حداقل یک کالا برای سفارش انتخاب کنید.");
      return;
    }

    const mother = customers.find(
      (item) => item.id === customerId
    );

    if (!mother) {
      alert("مشتری / مجموعه انتخاب‌شده پیدا نشد.");
      return;
    }

    const availableBranches = mother.customer_group_id
      ? branchCustomers.filter(
          (item) =>
            item.customer_group_id === mother.customer_group_id &&
            item.id !== mother.id
        )
      : [];

    const isGroupParent = Boolean(mother.customer_group_id);

    if (isGroupParent && !branchId) {
      alert("این مشتری یک مجموعه است. برای ثبت سفارش باید ابتدا شعبه را انتخاب کنید.");
      return;
    }

    if (isGroupParent && availableBranches.length === 0) {
      alert("برای این مجموعه هنوز هیچ شعبه‌ای ثبت نشده است.");
      return;
    }

    const actualCustomerId =
      isGroupParent ? branchId : mother.id;

    // مشتری مادرِ یک مجموعه هیچ‌وقت مجاز به دریافت سفارش مستقیم نیست.
    if (isGroupParent && actualCustomerId === mother.id) {
      alert("برای این مجموعه فقط شعبه واقعی قابل انتخاب است.");
      return;
    }

    const actualCustomer =
      actualCustomerId === mother.id
        ? mother
        : branchCustomers.find(
            (item) => item.id === actualCustomerId
          );

    if (!actualCustomer) {
      alert("شعبه انتخاب‌شده پیدا نشد.");
      return;
    }

    setSaving(true);

    try {
      /* ابتدا سفارش اصلی */

      const { data: order, error: orderError } =
        await supabase
          .from("orders")
          .insert({
            customer_id: actualCustomerId,
            customer_name: actualCustomer.name,
            visitor: visitor || actualCustomer.visitor || mother.visitor || null,
            status: "pending",
            total: orderTotal,
          })
          .select("*")
          .single();

      if (orderError) {
        console.error(orderError);
        alert(
          `خطا در ثبت سفارش: ${orderError.message}`
        );
        return;
      }

      /* سپس آیتم‌های سفارش */

      const itemsPayload = orderItems.map((item) => ({
        order_id: order.id,

        product_id: item.productId,

        product_name: item.productName,

        barcode: item.barcode,

        category: item.category,

        carton_size: item.cartonSize,

        order_cartons: item.orderCartons,

        order_units: item.orderUnits,

        total_units: item.totalUnits,

        consumer_price: item.consumerPrice,

        discount_percent: item.discountPercent,

        final_purchase_price:
          item.finalPurchasePrice,

        total: item.total,
      }));

      const { error: itemsError } =
        await supabase
          .from("order_items")
          .insert(itemsPayload);

      if (itemsError) {
        console.error(itemsError);

        /*
         * اگر آیتم‌ها ثبت نشدند،
         * سفارش اصلی را هم حذف می‌کنیم.
         */

        await supabase
          .from("orders")
          .delete()
          .eq("id", order.id);

        alert(
          `خطا در ثبت کالاهای سفارش: ${itemsError.message}`
        );

        return;
      }

      alert("سفارش با موفقیت ثبت شد.");

      closeOrderModal();

      await loadOrders();
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------ */
  /* تغییر وضعیت سفارش */
/* ------------------------------------------------ */

  async function changeStatus(
    orderId: string,
    status: string
  ) {
    const message =
      status === "approved"
        ? "سفارش تایید شود؟"
        : status === "cancelled"
        ? "سفارش باطل شود؟"
        : status === "delivered"
        ? "تحویل کامل سفارش تایید شود؟"
        : "";

    if (message && !confirm(message)) {
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        status,
      })
      .eq("id", orderId);

    if (error) {
      console.error(error);
      alert(
        `خطا در تغییر وضعیت سفارش: ${error.message}`
      );
      return;
    }

    await loadOrders();

    if (detail?.id === orderId) {
      setDetail({
        ...detail,
        status,
      });
    }
  }

  /* ------------------------------------------------ */
  /* حذف سفارش */
/* ------------------------------------------------ */

  async function deleteOrder(id: string) {
    if (
      !confirm(
        "آیا از حذف کامل این سفارش مطمئن هستید؟"
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert(
        `خطا در حذف سفارش: ${error.message}`
      );
      return;
    }

    setDetail(null);

    await loadOrders();
  }
  /* ------------------------------------------------ */
  /* ردیف‌های نمایشی جدول */
  /*
     صفحه سفارشات فقط سند «سفارش فروش» هر سفارش را نشان می‌دهد
     (یک ردیف به‌ازای هر سفارش، با دیتای زنده و وضعیت واقعی
     سفارش — از جمله تایید‌شده/تحویل‌شده). سند «فاکتور فروش»
     همان سفارش در صفحه انبار دیده می‌شود.
  ------------------------------------------------ */

  type DocumentRow = {
    id: string;
    order: Order;
    docType: string;
    invoiceTotal: number;
    sendDate: string | null;
  };

  const documentRows: DocumentRow[] = useMemo(() => {
    // از لحظه اولین تأیید، صفحه سفارشات باید فقط از نسخه رسمی فاکتور
    // بخواند. این Snapshot مستقل از تغییرات انبار است.
    const snapshotByOrder = new Map<string, OrderSnapshot>();

    for (const snapshot of orderSnapshots) {
      if (!snapshotByOrder.has(snapshot.order_id)) {
        snapshotByOrder.set(snapshot.order_id, snapshot);
      }
    }

    return orders.map((order) => {
      const frozenSnapshot =
        order.status !== "pending"
          ? snapshotByOrder.get(order.id)
          : undefined;

      return {
        id: order.id,
        order,
        docType: "سفارش فروش",
        invoiceTotal: frozenSnapshot
          ? Number(frozenSnapshot.invoice_total ?? 0)
          : Number(order.invoice_total || 0),
        sendDate: frozenSnapshot
          ? frozenSnapshot.send_date || null
          : order.send_date || null,
      };
    });
  }, [orders, orderSnapshots]);

  /* ------------------------------------------------ */
  /* ستون‌های جدول سفارشات با فیلتر و مرتب‌سازی */
  /* ------------------------------------------------ */

  const orderFilterLabels: Record<OrderFilterKey, string> = {
    customer: "مشتری",
    branch: "شعبه",
    province: "استان",
    visitor: "ویزیتور",
    createdAt: "تاریخ ثبت سفارش",
    sendDate: "تاریخ ارسال سفارش",
    invoiceTotal: "مبلغ کل",
    status: "وضعیت",
  };

  function getOrderFilterValue(row: DocumentRow, key: OrderFilterKey) {
    const order = row.order;

    if (key === "customer") {
      return (
        order.customers?.parent_name ||
        order.customers?.name ||
        order.customer_name ||
        ""
      );
    }
    if (key === "branch") return order.branch_name || "";
    if (key === "province") return order.customers?.province || "";
    if (key === "visitor") return order.customers?.visitor || order.visitor || "";
    if (key === "status") {
      const hasOfficialSnapshot = orderSnapshots.some(
        (snapshot) =>
          snapshot.order_id === order.id &&
          snapshot.snapshot_type === "official_invoice"
      );

      return statusInfo(
        hasOfficialSnapshot && order.status === "delivered"
          ? "approved"
          : order.status
      ).label;
    }
    if (key === "createdAt") return formatDate(order.created_at);
    if (key === "sendDate") return row.sendDate ? formatDate(row.sendDate) : "";
    return money(row.invoiceTotal || 0);
  }

  function getUniqueOrderFilterValues(key: OrderFilterKey) {
    return Array.from(
      new Set(
        documentRows
          .map((row) => getOrderFilterValue(row, key))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "fa"));
  }

  function toggleOrderFilterValue(key: OrderFilterKey, value: string) {
    setOrderFilterSelections((current) => {
      const selected = current[key];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];

      return {
        ...current,
        [key]: next,
      };
    });
  }

  function clearAllOrderFilters() {
    setOrderFilterSelections({
      customer: [],
      branch: [],
      province: [],
      visitor: [],
      status: [],
      createdAt: [],
      sendDate: [],
      invoiceTotal: [],
    });
    setOpenOrderFilter(null);
    setOrderFilterSearch("");
    setOrderSortKey(null);
  }

  function sortOrdersByFilter(key: OrderFilterKey, direction: "asc" | "desc") {
    setOrderSortKey(key);
    setOrderSortDirection(direction);
  }

  const filteredDocumentRows = [...documentRows]
    .filter((row) =>
      (Object.keys(orderFilterSelections) as OrderFilterKey[]).every((key) => {
        const selected = orderFilterSelections[key];
        if (selected.length === 0) return true;
        return selected.includes(getOrderFilterValue(row, key));
      })
    )
    .sort((a, b) => {
      if (!orderSortKey) return 0;

      const av = getOrderFilterValue(a, orderSortKey);
      const bv = getOrderFilterValue(b, orderSortKey);

      const result = av.localeCompare(bv, "fa", { numeric: true });
      return orderSortDirection === "asc" ? result : -result;
    });

  const docTypeStyle: Record<string, { bg: string; color: string }> = {
    "سفارش فروش": { bg: "#eff6ff", color: "#1d4ed8" },
    "فاکتور فروش": { bg: "#ecfdf5", color: "#047857" },
  };

  const orderTableColumns: DataTableColumn<DocumentRow>[] = [
    {
      key: "order_number",
      title: "کد سفارش",
      width: 90,
      filterable: false,
      searchable: true,
      sortable: false,
      accessor: (row) => row.order.order_number || "-",
      render: (value) => (
        <strong>{String(value ?? "-")}</strong>
      ),
    },
    {
      key: "doc_type",
      title: "نوع سند",
      width: 100,
      filterable: false,
      searchable: true,
      sortable: false,
      accessor: (row) => row.docType,
      render: (value) => {
        const label = String(value ?? "");
        const style = docTypeStyle[label] || {
          bg: "#f1f5f9",
          color: "#475569",
        };

        return (
          <span
            style={{
              display: "inline-flex",
              padding: "5px 10px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              background: style.bg,
              color: style.color,
            }}
          >
            {label}
          </span>
        );
      },
    },
    {
      key: "customer",
      title: "مشتری",
      width: 90,
      filterable: false,
      searchable: true,
      sortable: false,
      accessor: (row) =>
        row.order.customers?.parent_name ||
        row.order.customers?.name ||
        row.order.customer_name ||
        "-",
    },
    {
      key: "branch",
      title: "شعبه",
      width: 100,
      filterable: false,
      searchable: true,
      sortable: false,
      accessor: (row) => row.order.branch_name || "-",
    },
    {
      key: "province",
      title: "استان",
      width: 85,
      filterable: false,
      searchable: true,
      sortable: false,
      accessor: (row) => row.order.customers?.province || "-",
    },
    {
      key: "visitor",
      title: "ویزیتور",
      width: 100,
      filterable: false,
      searchable: true,
      sortable: false,
      accessor: (row) => row.order.customers?.visitor || row.order.visitor || "-",
    },
    {
      key: "created_at",
      title: "تاریخ ثبت سفارش",
      width: 100,
      filterable: false,
      searchable: true,
      sortable: false,
      accessor: (row) => formatDate(row.order.created_at),
    },
    {
      key: "send_date",
      title: "تاریخ ارسال سفارش",
      width: 110,
      filterable: false,
      searchable: true,
      sortable: false,
      accessor: (row) => row.sendDate ? formatDate(row.sendDate) : "-",
    },
    {
      key: "invoice_total",
      title: "مبلغ کل",
      width: 90,
      filterable: false,
      searchable: true,
      sortable: false,
      type: "number",
      accessor: (row) => row.invoiceTotal,
      render: (value) => (
        <strong>{money(Number(value || 0))}</strong>
      ),
    },
    {
      key: "status",
      title: "وضعیت",
      width: 100,
      filterable: false,
      searchable: true,
      sortable: false,
      accessor: (row) => {
        const hasOfficialSnapshot = orderSnapshots.some(
          (snapshot) =>
            snapshot.order_id === row.order.id &&
            snapshot.snapshot_type === "official_invoice"
        );

        return statusInfo(
          hasOfficialSnapshot && row.order.status === "delivered"
            ? "approved"
            : row.order.status
        ).label;
      },
      render: (_value, row) => {
        const hasOfficialSnapshot = orderSnapshots.some(
          (snapshot) =>
            snapshot.order_id === row.order.id &&
            snapshot.snapshot_type === "official_invoice"
        );

        const status = statusInfo(
          hasOfficialSnapshot && row.order.status === "delivered"
            ? "approved"
            : row.order.status
        );

        return (
          <span className={`badge ${status.className}`}>
            {status.label}
          </span>
        );
      },
    },
    {
      key: "actions",
      title: "عملیات",
      width: 90,
      filterable: false,
      searchable: false,
      sortable: false,
      accessor: () => "",
      render: (_value, row) => {
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => router.push(`/orders/${row.order.id}`)}
              title="مشاهده سفارش"
              style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}
            >
              <Eye size={15} />
            </button>
          </div>
        );
      },
    },
  ];



  /* ------------------------------------------------ */
  /* Render */
/* ------------------------------------------------ */

  return (
    <>
      <style jsx global>{`
        .orders-page-compact table {
          width: 100% !important;
          table-layout: fixed !important;
        }

        .orders-page-compact th,
        .orders-page-compact td {
          padding: 8px 6px !important;
          font-size: 13px !important;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .orders-page-compact .table-wrap {
          width: 100% !important;
          overflow-x: hidden !important;
        }

        .orders-page-compact th,
        .orders-page-compact td {
          text-align: center !important;
        }

        .orders-page-compact .data-table-header {
          width: 100% !important;
          justify-content: center !important;
        }
      `}</style>
      <AppShell>
      <PageHeader
        title="سفارشات"
        subtitle="ثبت، بررسی و مدیریت سفارش مشتریان"
        action={

          <button
  className="btn btn-primary btn-small"
  onClick={()=>router.push("/orders/new")}
>
  <Plus size={12} />
  ثبت سفارش جدید
</button>
        }
      />

      {/* نوار فیلتر مستقل از جدول */}
      <div
        dir="rtl"
        style={{
          width: "100%",
          marginBottom: 12,
          marginTop: -24,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "78%",
            display: "flex",
            alignItems: "stretch",
            direction: "rtl",
            background: "#f2f4f3",
            border: "1px solid #cfd6d2",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
            overflow: "visible",
          }}
        >
          {(Object.keys(orderFilterLabels) as OrderFilterKey[]).map((key) => {
            const isOpen = openOrderFilter === key;
            const selected = orderFilterSelections[key];

            const values = getUniqueOrderFilterValues(key).filter((value) =>
              value.toLowerCase().includes(orderFilterSearch.toLowerCase())
            );

            return (
              <div
                key={key}
                style={{
                  position: "relative",
                  flex: "1 1 0",
                  minWidth: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenOrderFilter((current) => (current === key ? null : key));
                    setOrderFilterSearch("");
                  }}
                  style={{
                    width: "100%",
                    height: 42,
                    border: "0",
                    borderLeft: "1px solid #cfd6d2",
                    borderRadius: 0,
                    background: selected.length ? "#149b5c" : "#f2f4f3",
                    color: selected.length ? "#fff" : "#1f2937",
                    fontWeight: selected.length ? 800 : 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "0 10px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selected.length
                      ? `${orderFilterLabels[key]} (${selected.length})`
                      : orderFilterLabels[key]}
                  </span>

                  <span style={{ fontSize: 10 }}>
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 4px)",
                      width: 300,
                      zIndex: 10000,
                      background: "#fff",
                      border: "1px solid #cfd6d2",
                      borderRadius: 8,
                      boxShadow: "0 14px 30px rgba(15,23,42,.14)",
                      padding: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                        marginBottom: 8,
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => sortOrdersByFilter(key, "asc")}
                      >
                        مرتب‌سازی صعودی
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => sortOrdersByFilter(key, "desc")}
                      >
                        مرتب‌سازی نزولی
                      </button>
                    </div>

                    <input
                      className="input"
                      placeholder={`جستجو در ${orderFilterLabels[key]}...`}
                      value={orderFilterSearch}
                      onChange={(e) => setOrderFilterSearch(e.target.value)}
                      style={{ marginBottom: 8 }}
                    />

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      <span>انتخاب چند مقدار</span>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#0f6b43",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                          onClick={() =>
                            setOrderFilterSelections((current) => ({
                              ...current,
                              [key]: [...getUniqueOrderFilterValues(key)],
                            }))
                          }
                        >
                          انتخاب همه
                        </button>

                        <button
                          type="button"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#dc2626",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                          onClick={() =>
                            setOrderFilterSelections((current) => ({
                              ...current,
                              [key]: [],
                            }))
                          }
                        >
                          پاک‌کردن
                        </button>
                      </div>
                    </div>

                    <div style={{ maxHeight: 240, overflowY: "auto" }}>
                      {values.map((value) => (
                        <label
                          key={value}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "7px 4px",
                            cursor: "pointer",
                            borderRadius: 6,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(value)}
                            onChange={() => toggleOrderFilterValue(key, value)}
                          />
                          <span>{value}</span>
                        </label>
                      ))}

                      {values.length === 0 && (
                        <div
                          style={{
                            padding: 12,
                            textAlign: "center",
                            color: "#94a3b8",
                          }}
                        >
                          مقداری پیدا نشد
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={clearAllOrderFilters}
            title="حذف همه فیلترها"
            style={{
              flex: "0 0 42px",
              height: 42,
              border: "0",
              background: "#dc2626",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 0,
            }}
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </div>

      {/* لیست سفارشات */}

      <div className="panel orders-page-compact">
        {loading ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
            }}
          >
            در حال دریافت سفارشات...
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "#64748b",
            }}
          >
            هنوز سفارشی ثبت نشده است.
          </div>
        ) : (
          <DataTable
            data={filteredDocumentRows}
            columns={orderTableColumns}
            rowKey={(row) => row.id}
            pageSize={0}
            emptyText="سفارشی پیدا نشد."
          />
        )}
      </div>

      {/* ------------------------------------------------ */}
      {/* مودال ثبت سفارش */}
      {/* ------------------------------------------------ */}

      {modal && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 1250,
              width: "95%",
            }}
          >
            <div className="modal-header">
              <div>
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  ثبت سفارش جدید
                </h2>

                <div
                  style={{
                    marginTop: 5,
                    color: "#64748b",
                    fontSize: 13,
                  }}
                >
                  قیمت نهایی بر اساس تخفیف گروه کالایی
                  مشتری محاسبه می‌شود.
                </div>
              </div>

              <button
                className="close-btn"
                onClick={closeOrderModal}
              >
                ×
              </button>
            </div>

            {/* اطلاعات سفارش */}

            <div
              className="form-grid"
              style={{
                marginBottom: 20,
              }}
            >
              <div className="form-field">
                <label>مجموعه / مشتری</label>

                <select
                  className="input"
                  value={customerId}
                  onChange={(e) =>
                    handleCustomerChange(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    انتخاب مجموعه / مشتری
                  </option>

                  {customers.map((customer) => (
                    <option
                      key={customer.id}
                      value={customer.id}
                    >
                      {customer.customer_group_id
                        ? `${customer.name} — انتخاب شعبه الزامی است`
                        : customer.name}
                    </option>
                  ))}
                </select>
              </div>

              {customerId && (() => {
                const mother = customers.find(
                  (item) => item.id === customerId
                );

                const branches = mother?.customer_group_id
                  ? branchCustomers.filter(
                      (item) =>
                        item.customer_group_id === mother.customer_group_id &&
                        item.id !== mother.id
                    )
                  : [];

                if (branches.length === 0) {
                  return (
                    <div
                      className="form-field"
                      style={{
                        gridColumn: "1 / -1",
                        color: "#b91c1c",
                      }}
                    >
                      <label>شعبه</label>
                      <div
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                        }}
                      >
                        این مجموعه هنوز شعبه‌ای ندارد؛ سفارش برای مشتری مادر مجاز نیست.
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="form-field">
                    <label>شعبه واقعی سفارش</label>
                    <select
                      className="input"
                      value={branchId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        setBranchId(selectedId);

                        const branch = branches.find(
                          (item) => item.id === selectedId
                        );

                        if (branch?.visitor) {
                          setVisitor(branch.visitor);
                        }
                      }}
                    >
                      <option value="">انتخاب شعبه</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div
                style={{
                  gridColumn: "1 / -1",
                  marginTop: -8,
                  marginBottom: 4,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#475569",
                  fontSize: 12,
                }}
              >
                برای مجموعه‌ها، نام بالا فقط «مجموعه مادر» است و هیچ سفارشی
                به آن ثبت نمی‌شود؛ سفارش فقط با انتخاب یک شعبه واقعی ثبت خواهد شد.
              </div>

              <div className="form-field">
                <label>ویزیتور</label>

                <input
                  className="input"
                  value={visitor}
                  onChange={(e) =>
                    setVisitor(e.target.value)
                  }
                  placeholder="نام ویزیتور"
                />
              </div>
            </div>

            {/* تخفیف‌های مشتری */}

            {customerId && (
              <div
                style={{
                  padding: 15,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    marginBottom: 10,
                  }}
                >
                  تخفیف‌های مشتری
                </div>

                {discounts.length === 0 ? (
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: 13,
                    }}
                  >
                    برای این مشتری تخفیف گروهی
                    ثبت نشده است؛ بنابراین همه
                    کالاها با تخفیف ۰٪ محاسبه
                    می‌شوند.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {discounts.map(
                      (discount) => (
                        <span
                          key={discount.category}
                          style={{
                            padding:
                              "6px 10px",
                            borderRadius: 8,
                            background:
                              "#ffffff",
                            border:
                              "1px solid #e2e8f0",
                            fontSize: 13,
                          }}
                        >
                          {discount.category}:
                          {" "}
                          <strong>
                            {toPersianDigits(
                              discount.discount_percent
                            )}
                            ٪
                          </strong>
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {/* جستجوی کالا */}

            <div
              style={{
                marginBottom: 15,
              }}
            >
              <div
                style={{
                  position: "relative",
                }}
              >
                <Search
                  size={17}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: 13,
                    color: "#94a3b8",
                  }}
                />

                <input
                  className="input"
                  style={{
                    paddingRight: 40,
                  }}
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="جستجوی نام کالا، بارکد یا گروه کالا..."
                />
              </div>
            </div>

            {/* جدول کالاها */}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ردیف</th>
                    <th>بارکد کالا</th>
                    <th>نام کالا</th>
                    <th>گروه کالا</th>
                    <th>تعداد در کارتن</th>
                    <th>سفارش به کارتن</th>
                    <th>سفارش به جزء</th>
                    <th>قیمت مصرف‌کننده</th>
                    <th>تخفیف</th>
                    <th>قیمت خرید نهایی</th>
                    <th>جمع کل پرداختی</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map(
                    (product, index) => {
                      const quantity =
                        getQuantity(product.id);

                      const cartonSize =
                        Math.max(
                          Number(
                            product.quantity_per_carton ||
                              1
                          ),
                          1
                        );

                      const discount =
                        getDiscountForCategory(
                          product.category
                        );

                      const finalPrice =
                        getFinalPrice(product);

                      const cartons =
                        Number(
                          quantity.cartons || 0
                        );

                      const units =
                        Number(
                          quantity.units || 0
                        );

                      const totalUnits =
                        cartons *
                          cartonSize +
                        units;

                      const rowTotal =
                        totalUnits *
                        finalPrice;

                      return (
                        <tr
                          key={product.id}
                        >
                          <td>
                            {toPersianDigits(
                              index + 1
                            )}
                          </td>

                          <td>
                            {product.barcode ||
                              "-"}
                          </td>

                          <td>
                            <strong>
                              {product.name}
                            </strong>
                          </td>

                          <td>
                            {product.category ||
                              "-"}
                          </td>

                          <td>
                            {toPersianDigits(
                              cartonSize
                            )}
                          </td>

                          <td
                            style={{
                              minWidth: 120,
                            }}
                          >
                            <input
                              className="input"
                              type="text"
                              inputMode="numeric"
                              value={
                                quantity.cartons
                                  ? toPersianDigits(
                                      quantity.cartons
                                    )
                                  : ""
                              }
                              onChange={(e) =>
                                updateQuantity(
                                  product.id,
                                  "cartons",
                                  e.target.value
                                )
                              }
                              placeholder="کارتن"
                            />
                          </td>

                          <td
                            style={{
                              minWidth: 120,
                            }}
                          >
                            <input
                              className="input"
                              type="text"
                              inputMode="numeric"
                              value={
                                quantity.units
                                  ? toPersianDigits(
                                      quantity.units
                                    )
                                  : ""
                              }
                              onChange={(e) =>
                                updateQuantity(
                                  product.id,
                                  "units",
                                  e.target.value
                                )
                              }
                              placeholder="عدد"
                            />
                          </td>

                          <td>
                            {money(
                              product.consumer_price
                            )}
                          </td>

                          <td>
                            <strong>
                              {toPersianDigits(
                                discount
                              )}
                              ٪
                            </strong>
                          </td>

                          <td>
                            <strong>
                              {money(
                                finalPrice
                              )}
                            </strong>
                          </td>

                          <td>
                            {totalUnits > 0
                              ? money(rowTotal)
                              : "-"}
                          </td>
                        </tr>
                      );
                    }
                  )}

                  {filteredProducts.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={11}
                        style={{
                          textAlign: "center",
                          padding: 30,
                        }}
                      >
                        کالایی پیدا نشد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* جمع سفارش */}

            <div
              style={{
                marginTop: 20,
                padding: 18,
                borderRadius: 12,
                background: "#f8fafc",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: 15,
                flexWrap: "wrap",
              }}
            >
              <div>
                <span
                  style={{
                    color: "#64748b",
                  }}
                >
                  تعداد ردیف‌های سفارش:
                </span>

                <strong
                  style={{
                    marginRight: 8,
                  }}
                >
                  {toPersianDigits(
                    orderItems.length
                  )}
                </strong>
              </div>

              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                جمع کل پرداختی:
                <span
                  style={{
                    marginRight: 8,
                  }}
                >
                  {money(orderTotal)}
                </span>
              </div>
            </div>

            {/* دکمه‌ها */}

            <div
              className="action-row"
              style={{
                marginTop: 20,
              }}
            >
              <button
                className="btn btn-primary"
                onClick={createOrder}
                disabled={saving}
              >
                <Check size={16} />

                {saving
                  ? "در حال ثبت..."
                  : "ثبت و ارسال سفارش"}
              </button>

              <button
                className="btn btn-secondary"
                onClick={closeOrderModal}
                disabled={saving}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* جزئیات سفارش */}
      {/* ------------------------------------------------ */}

      {detail && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 1200,
              width: "95%",
            }}
          >
            <div className="modal-header">
              <div>
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  جزئیات سفارش {detail.id}
                </h2>

                <div
                  style={{
                    marginTop: 5,
                    color: "#64748b",
                    fontSize: 13,
                  }}
                >
                  {formatDate(
                    detail.created_at
                  )}
                </div>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setDetail(null)
                }
              >
                ×
              </button>
            </div>

            {/* اطلاعات */}

            <div
              className="form-grid"
              style={{
                marginBottom: 20,
              }}
            >
              <div className="form-field">
                <label>مشتری</label>

                <div
                  style={{
                    padding: 12,
                    background: "#f8fafc",
                    borderRadius: 8,
                  }}
                >
                  {detail.customer_name}
                </div>
              </div>

              <div className="form-field">
                <label>ویزیتور</label>

                <div
                  style={{
                    padding: 12,
                    background: "#f8fafc",
                    borderRadius: 8,
                  }}
                >
                  {detail.visitor || "-"}
                </div>
              </div>

              <div className="form-field">
                <label>وضعیت</label>

                <div
                  style={{
                    padding: 12,
                  }}
                >
                  {(() => {
                    const status =
                      statusInfo(
                        detail.status
                      );

                    return (
                      <span
                        className={`badge ${status.className}`}
                      >
                        {status.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* اقلام سفارش */}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ردیف</th>
                    <th>بارکد</th>
                    <th>کالا</th>
                    <th>گروه</th>
                    <th>کارتن</th>
                    <th>جزء</th>
                    <th>قیمت مصرف‌کننده</th>
                    <th>تخفیف</th>
                    <th>قیمت خرید نهایی</th>
                    <th>جمع</th>
                  </tr>
                </thead>

                <tbody>
                  {(detail.order_items ||
                    []).map(
                    (item, index) => (
                      <tr
                        key={
                          item.productId ||
                          index
                        }
                      >
                        <td>
                          {toPersianDigits(
                            index + 1
                          )}
                        </td>

                        <td>
                          {item.products?.barcode || "-"}
                        </td>

                        <td>
                          {item.products?.name || "-"}
                        </td>

                        <td>
                          {item.products?.category || "-"}
                        </td>

                        <td>
                          {toPersianDigits(item.orderCartons || 0)}
                        </td>

                        <td>
                          {toPersianDigits(item.orderUnits || 0)}
                        </td>

                        <td>
                          {money(
                            item.consumerPrice
                          )}
                        </td>

                        <td>
                          {toPersianDigits(
                            item.discountPercent|| 0
                          )}
                          ٪
                        </td>

                        <td>
                          <strong>
                            {money(
                              item.finalPurchasePrice
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong>
                            {money(
                              item.total
                            )}
                          </strong>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* جمع */}

            <div
              style={{
                marginTop: 20,
                padding: 18,
                background: "#f8fafc",
                borderRadius: 12,
                textAlign: "left",
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              جمع کل پرداختی:
              <span
                style={{
                  marginRight: 8,
                }}
              >
                {money(detail.invoice_total)}
              </span>
            </div>

            {/* عملیات */}

            <div
              className="action-row"
              style={{
                marginTop: 20,
              }}
            >
              {detail.status ===
                "pending" && (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      changeStatus(
                        detail.id,
                        "approved"
                      )
                    }
                  >
                    <Check size={16} />
                    تایید سفارش
                  </button>

                  <button
                    className="btn btn-danger"
                    onClick={() =>
                      changeStatus(
                        detail.id,
                        "cancelled"
                      )
                    }
                  >
                    <X size={16} />
                    ابطال سفارش
                  </button>
                </>
              )}

              {detail.status ===
                "approved" && (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      changeStatus(
                        detail.id,
                        "delivered"
                      )
                    }
                  >
                    <Check size={16} />
                    تایید تحویل کامل
                  </button>

                  <button
                    className="btn btn-danger"
                    onClick={() =>
                      changeStatus(
                        detail.id,
                        "cancelled"
                      )
                    }
                  >
                    <X size={16} />
                    ابطال سفارش
                  </button>
                </>
              )}

              {detail.status ===
                "cancelled" && (
                <span
                  style={{
                    color: "#dc2626",
                    fontWeight: 700,
                  }}
                >
                  این سفارش باطل شده است.
                </span>
              )}

              {detail.status ===
                "delivered" && (
                <span
                  style={{
                    color: "#16a34a",
                    fontWeight: 700,
                  }}
                >
                  این سفارش تحویل شده است.
                </span>
              )}

              <button
                className="btn btn-danger"
                onClick={() =>
                  deleteOrder(detail.id)
                }
              >
                <Trash2 size={15} />
                حذف سفارش
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
    </>
  );
}
