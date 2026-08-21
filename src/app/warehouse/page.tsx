"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import DataTable, { DataTableColumn } from "@/components/DataTable/DataTable";
import { supabase } from "@/lib/supabase";

type Order = {
  id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  visitor?: string | null;
  status: string;
  invoice_total?: number | null;
  created_at: string;
  order_number?: string | null;
  send_date?: string | null;
  warehouse_send_date?: string | null;
  delivery_date?: string | null;
  cancelled_from?: string | null;
  cancelled_at?: string | null;
  customers?: {
    name: string;
    visitor: string | null;
    province?: string | null;
  } | null;
};

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

function formatNumber(value: number | string | null | undefined) {
  const digits = digitsOnly(String(value ?? ""));
  if (!digits) return "۰";
  return toPersianDigits(digits.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
}

function money(value: number | string | null | undefined) {
  return `${formatNumber(value)} ریال`;
}

function formatDate(value: string) {
  if (!value) return "-";

  try {
    // تاریخ‌های سفارش در سیستم به صورت timestamp هستند
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

// نمایش تاریخ تحویل همیشه به شمسی.
// تاریخ ممکن است از دیتابیس به دو شکل برسد:
//   1) شمسی: 1405/05/22
//   2) میلادی/ISO: 2026-08-13
// در هر دو حالت خروجی این ستون شمسی است.
function formatDeliveryDate(value: string | null | undefined) {
  if (!value) return "-";

  const clean = String(value).trim();
  const datePart = clean.split(" ")[0];

  // اگر مقدار از ابتدا شمسی ذخیره شده باشد، همان را نمایش بده.
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

  // اگر مقدار ISO/Gregorian باشد، آن را به شمسی تبدیل کن.
  const normalized =
    datePart.length === 10 && datePart.includes("-")
      ? `${datePart}T12:00:00`
      : clean;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return clean;
  }

  const formatter = new Intl.DateTimeFormat(
    "fa-IR-u-ca-persian-nu-latn",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );

  const parts = formatter.formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";

  return `${toPersianDigits(year)}/${toPersianDigits(month)}/${toPersianDigits(day)}`;
}

// تاریخ امروز به شمسی، با همان فرمت ذخیره‌شده در دیتابیس (YYYY/MM/DD)
// این تابع فقط برای نمایش پیش‌فرض استفاده می‌شود؛ چیزی در دیتابیس ذخیره نمی‌کند.
function getTodayJalaliString() {
  const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}/${month}/${day}`;
}

function warehouseStatus(
  status: string,
  cancelledFrom?: string | null
) {
  if (status === "delivered") {
    return { label: "تحویل داده شد", className: "success" };
  }

  if (status === "cancelled") {
    const fromLabel =
      cancelledFrom === "approved"
        ? "در حال ارسال"
        : cancelledFrom === "delivered"
        ? "تحویل داده شد"
        : cancelledFrom === "pending"
        ? "در انتظار تایید"
        : "سفارش";

    return {
      label: `ابطال (${fromLabel})`,
      className: "danger",
    };
  }

  return { label: "در حال ارسال", className: "warning" };
}

type WarehouseFilterKey =
  | "customer"
  | "province"
  | "visitor"
  | "createdAt"
  | "sendDate"
  | "deliveryDate"
  | "invoiceTotal"
  | "status";

export default function WarehousePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  /* ------------------------------------------------ */
  /* فیلتر و جستجوی ستونی */
  /* ------------------------------------------------ */

  const [filterSelections, setFilterSelections] = useState<
    Record<WarehouseFilterKey, string[]>
  >({
    customer: [],
    province: [],
    visitor: [],
    createdAt: [],
    sendDate: [],
    deliveryDate: [],
    invoiceTotal: [],
    status: [],
  });

  const [openFilter, setOpenFilter] = useState<WarehouseFilterKey | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [sortKey, setSortKey] = useState<WarehouseFilterKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        customers(
          name,
          visitor,
          province
        )
      `)
      .in("status", ["approved", "delivered", "cancelled"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(`خطا در دریافت سفارشات انبار: ${error.message}`);
      setLoading(false);
      return;
    }

    setOrders((data || []) as Order[]);
    setLoading(false);
  }

  const filterLabels: Record<WarehouseFilterKey, string> = {
    customer: "مشتری",
    province: "استان",
    visitor: "ویزیتور",
    createdAt: "تاریخ ثبت سفارش",
    sendDate: "تاریخ ارسال سفارش",
    deliveryDate: "تاریخ تحویل سفارش",
    invoiceTotal: "مبلغ کل",
    status: "وضعیت",
  };

  function getFilterValue(order: Order, key: WarehouseFilterKey) {
    if (key === "customer") return order.customers?.name || order.customer_name || "";
    if (key === "province") return order.customers?.province || "";
    if (key === "visitor") return order.customers?.visitor || order.visitor || "";
    if (key === "createdAt") return formatDate(order.created_at);
    if (key === "sendDate")
      return formatDeliveryDate(order.warehouse_send_date || order.send_date || null);
    if (key === "deliveryDate")
      return formatDeliveryDate(
        order.delivery_date ||
          order.warehouse_send_date ||
          order.send_date ||
          getTodayJalaliString()
      );
    if (key === "invoiceTotal") return money(order.invoice_total || 0);
    return warehouseStatus(order.status, order.cancelled_from).label;
  }

  function getUniqueFilterValues(key: WarehouseFilterKey) {
    return Array.from(
      new Set(orders.map((order) => getFilterValue(order, key)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "fa"));
  }

  function toggleFilterValue(key: WarehouseFilterKey, value: string) {
    setFilterSelections((current) => {
      const selected = current[key];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];

      return { ...current, [key]: next };
    });
  }

  function clearAllFilters() {
    setFilterSelections({
      customer: [],
      province: [],
      visitor: [],
      createdAt: [],
      sendDate: [],
      deliveryDate: [],
      invoiceTotal: [],
      status: [],
    });
    setOpenFilter(null);
    setFilterSearch("");
    setSortKey(null);
  }

  function sortByFilter(key: WarehouseFilterKey, direction: "asc" | "desc") {
    setSortKey(key);
    setSortDirection(direction);
  }

  const filteredOrders = [...orders]
    .filter((order) =>
      (Object.keys(filterSelections) as WarehouseFilterKey[]).every((key) => {
        const selected = filterSelections[key];
        if (selected.length === 0) return true;
        return selected.includes(getFilterValue(order, key));
      })
    )
    .sort((a, b) => {
      if (!sortKey) return 0;

      const av = getFilterValue(a, sortKey);
      const bv = getFilterValue(b, sortKey);

      const result = av.localeCompare(bv, "fa", { numeric: true });
      return sortDirection === "asc" ? result : -result;
    });

  const columns = useMemo<DataTableColumn<Order>[]>(
    () => [
      {
        key: "order_number",
        title: "کد سفارش",
        width: 90,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) => row.order_number || "-",
      },
      {
        key: "doc_type",
        title: "نوع سند",
        width: 100,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: () => "فاکتور فروش",
        render: () => (
          <span
            style={{
              display: "inline-flex",
              padding: "5px 10px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              background: "#ecfdf5",
              color: "#047857",
            }}
          >
            فاکتور فروش
          </span>
        ),
      },
      {
        key: "customer",
        title: "مشتری",
        width: 120,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) => row.customers?.name || row.customer_name || "-",
      },
      {
        key: "province",
        title: "استان",
        width: 90,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) => row.customers?.province || "-",
      },
      {
        key: "visitor",
        title: "ویزیتور",
        width: 100,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) => row.customers?.visitor || row.visitor || "-",
      },
      {
        key: "created_at",
        title: "تاریخ ثبت سفارش",
        width: 110,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) => formatDate(row.created_at),
      },
      {
        key: "warehouse_send_date",
        title: "تاریخ ارسال سفارش",
        width: 120,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) =>
          formatDeliveryDate(row.warehouse_send_date || row.send_date || null),
      },
      {
        key: "delivery_date",
        title: "تاریخ تحویل سفارش",
        width: 120,
        filterable: false,
        searchable: true,
        sortable: false,
        // اگر تاریخ تحویل هنوز ثبت نشده باشد (سفارش هنوز در حال ارسال
        // است)، به‌صورت پیش‌فرض همان تاریخ ارسال سفارش نمایش داده می‌شود.
        accessor: (row) =>
          formatDeliveryDate(
            row.delivery_date ||
              row.warehouse_send_date ||
              row.send_date ||
              getTodayJalaliString()
          ),
      },
      {
        key: "invoice_total",
        title: "مبلغ کل",
        width: 100,
        filterable: false,
        searchable: true,
        sortable: false,
        type: "number",
        accessor: (row) => Number(row.invoice_total || 0),
        render: (value) => <strong>{money(Number(value || 0))}</strong>,
      },
      {
        key: "status",
        title: "وضعیت",
        width: 110,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) => warehouseStatus(row.status, row.cancelled_from).label,
        render: (_value, row) => {
          const status = warehouseStatus(row.status, row.cancelled_from);

          return <span className={`badge ${status.className}`}>{status.label}</span>;
        },
      },
      {
        key: "actions",
        title: "عملیات",
        width: 110,
        filterable: false,
        searchable: false,
        sortable: false,
        accessor: () => "",
        render: (_value, row) => (
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => router.push(`/warehouse/${row.id}`)}
            title={row.status === "cancelled" ? "مشاهده" : "مشاهده / ویرایش"}
            style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}
          >
            <Eye size={15} />
          </button>
        ),
      },
    ],
    [router]
  );

  return (
    <AppShell>
      <style jsx global>{`
        .warehouse-page-compact table {
          width: 100% !important;
          table-layout: fixed !important;
        }

        .warehouse-page-compact th,
        .warehouse-page-compact td {
          padding: 8px 6px !important;
          font-size: 13px !important;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center !important;
        }

        .warehouse-page-compact .table-wrap {
          width: 100% !important;
          overflow-x: hidden !important;
        }

        .warehouse-page-compact .data-table-header {
          width: 100% !important;
          justify-content: center !important;
        }
      `}</style>

      <PageHeader
        title="انبار"
        subtitle="مدیریت سفارش‌های تأییدشده و تحویل سفارشات"
      />

      {/* نوار فیلتر مستقل از جدول */}
      <div
        dir="rtl"
        style={{
          width: "100%",
          marginBottom: 12,
          marginTop: -18,
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
          {(Object.keys(filterLabels) as WarehouseFilterKey[]).map((key) => {
            const isOpen = openFilter === key;
            const selected = filterSelections[key];

            const values = getUniqueFilterValues(key).filter((value) =>
              value.toLowerCase().includes(filterSearch.toLowerCase())
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
                    setOpenFilter((current) => (current === key ? null : key));
                    setFilterSearch("");
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
                      ? `${filterLabels[key]} (${selected.length})`
                      : filterLabels[key]}
                  </span>

                  <span style={{ fontSize: 10 }}>{isOpen ? "▲" : "▼"}</span>
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
                        onClick={() => sortByFilter(key, "asc")}
                      >
                        مرتب‌سازی صعودی
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => sortByFilter(key, "desc")}
                      >
                        مرتب‌سازی نزولی
                      </button>
                    </div>

                    <input
                      className="input"
                      placeholder={`جستجو در ${filterLabels[key]}...`}
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
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
                            setFilterSelections((current) => ({
                              ...current,
                              [key]: [...getUniqueFilterValues(key)],
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
                            setFilterSelections((current) => ({
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
                            onChange={() => toggleFilterValue(key, value)}
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
            onClick={clearAllFilters}
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

      <div className="panel warehouse-page-compact">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            در حال دریافت سفارشات انبار...
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "#64748b",
            }}
          >
            هنوز سفارشی در انبار ثبت نشده است.
          </div>
        ) : (
          <DataTable
            data={filteredOrders}
            columns={columns}
            rowKey={(order) => order.id}
            pageSize={0}
            emptyText="سفارشی در انبار پیدا نشد."
          />
        )}
      </div>
    </AppShell>
  );
}
