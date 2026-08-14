"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
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

function formatSendDate(value: string | null | undefined) {
  if (!value) return "-";

  const clean = String(value).trim();
  const raw = clean.substring(0, 10);

  const jalaliParts = raw.split("/");
  if (
    jalaliParts.length === 3 &&
    Number(jalaliParts[0]) >= 1300 &&
    Number(jalaliParts[0]) <= 1500
  ) {
    return `${toPersianDigits(jalaliParts[0])}/${toPersianDigits(
      String(jalaliParts[1]).padStart(2, "0")
    )}/${toPersianDigits(
      String(jalaliParts[2]).padStart(2, "0")
    )}`;
  }

  const date = new Date(`${raw}T12:00:00`);

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
    return { label: "تحویل داده شد", className: "info" };
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
      className: "cancelled",
    };
  }

  return { label: "در حال ارسال", className: "warning" };
}

export default function WarehousePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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

  const columns = useMemo<DataTableColumn<Order>[]>(
    () => [
      {
        key: "order_number",
        title: "کد سفارش",
        width: 100,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) => row.order_number || "-",
      },
      {
        key: "customer",
        title: "مشتری",
        width: 130,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) => row.customers?.name || row.customer_name || "-",
      },
      {
        key: "province",
        title: "استان",
        width: 90,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) => row.customers?.province || "-",
      },
      {
        key: "visitor",
        title: "ویزیتور",
        width: 110,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) => row.customers?.visitor || row.visitor || "-",
      },
      {
        key: "created_at",
        title: "تاریخ ثبت سفارش",
        width: 120,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) => formatDate(row.created_at),
      },
      {
        key: "warehouse_send_date",
        title: "تاریخ ارسال سفارش",
        width: 130,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) =>
          formatSendDate(
            row.warehouse_send_date || row.send_date || null
          ),
      },
      {
        key: "delivery_date",
        title: "تاریخ تحویل سفارش",
        width: 130,
        filterable: true,
        searchable: true,
        sortable: true,
        // اگر تاریخ تحویل هنوز ثبت نشده باشد (هنوز ویرایش نخورده)،
        // به‌صورت پیش‌فرض تاریخ امروز به شمسی نمایش داده می‌شود.
        // به محض ثبت واقعی از صفحه ویرایش، همان مقدار ذخیره‌شده نمایش داده می‌شود.
        accessor: (row) =>
          row.delivery_date
            ? formatDeliveryDate(row.delivery_date)
            : formatDeliveryDate(getTodayJalaliString()),
      },
      {
        key: "invoice_total",
        title: "مبلغ کل",
        width: 140,
        filterable: true,
        searchable: true,
        sortable: true,
        type: "number",
        accessor: (row) => Number(row.invoice_total || 0),
        render: (value) => <strong>{money(Number(value || 0))}</strong>,
      },
      {
        key: "status",
        title: "وضعیت",
        width: 110,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) =>
          warehouseStatus(row.status, row.cancelled_from).label,
        render: (_value, row) => {
          const status = warehouseStatus(
            row.status,
            row.cancelled_from
          );

          const background =
            row.status === "approved"
              ? "#fed7aa"
              : row.status === "delivered"
              ? "#dcfce7"
              : row.status === "cancelled"
              ? "#fecaca"
              : "#f8fafc";

          const foreground =
            row.status === "approved"
              ? "#9a3412"
              : row.status === "delivered"
              ? "#166534"
              : row.status === "cancelled"
              ? "#b91c1c"
              : "#475569";

          return (
            <div
              style={{
                width: "calc(100% + 12px)",
                minHeight: "100%",
                margin: "-8px -6px",
                padding: "8px 6px",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background,
                color: foreground,
                fontWeight: 700,
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {status.label}
            </div>
          );
        },
      },
      {
        key: "actions",
        title: "عملیات",
        width: 120,
        filterable: false,
        searchable: false,
        sortable: false,
        accessor: () => "",
        render: (_value, row) => (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => router.push(`/warehouse/${row.id}`)}
            >
              <Eye size={15} />
              {row.status === "cancelled"
                ? "مشاهده"
                : "مشاهده / ویرایش"}
            </button>


          </div>
        ),
      },
    ],
    [router]
  );

  return (
    <AppShell>
      <style jsx global>{`
        .warehouse-page-auto {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .warehouse-page-auto .table-wrap {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
        }

        .warehouse-page-auto table {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
        }

        .warehouse-page-auto th,
        .warehouse-page-auto td {
          padding: 7px 5px !important;
          font-size: clamp(11px, 0.82vw, 14px) !important;
          line-height: 1.35 !important;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          box-sizing: border-box !important;
        }

        .warehouse-page-auto th:nth-child(1),
        .warehouse-page-auto td:nth-child(1) { width: 8% !important; }

        .warehouse-page-auto th:nth-child(2),
        .warehouse-page-auto td:nth-child(2) { width: 13% !important; }

        .warehouse-page-auto th:nth-child(3),
        .warehouse-page-auto td:nth-child(3) { width: 8% !important; }

        .warehouse-page-auto th:nth-child(4),
        .warehouse-page-auto td:nth-child(4) { width: 10% !important; }

        .warehouse-page-auto th:nth-child(5),
        .warehouse-page-auto td:nth-child(5) { width: 10% !important; }

        .warehouse-page-auto th:nth-child(6),
        .warehouse-page-auto td:nth-child(6) { width: 10% !important; }

        .warehouse-page-auto th:nth-child(7),
        .warehouse-page-auto td:nth-child(7) { width: 10% !important; }

        .warehouse-page-auto th:nth-child(8),
        .warehouse-page-auto td:nth-child(8) { width: 11% !important; }

        .warehouse-page-auto th:nth-child(9),
        .warehouse-page-auto td:nth-child(9) { width: 8% !important; }

        .warehouse-page-auto th:nth-child(10),
        .warehouse-page-auto td:nth-child(10) { width: 13% !important; min-width: 135px !important; }
      `}</style>

      <PageHeader
        title="انبار"
        subtitle="مدیریت سفارش‌های تأییدشده و تحویل سفارشات"
      />

      <div className="panel warehouse-page-auto">
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
            data={orders}
            columns={columns}
            rowKey={(order) => order.id}
            rowClassName={() => ""}
            pageSize={0}
            emptyText="سفارشی در انبار پیدا نشد."
          />
        )}
      </div>
    </AppShell>
  );
}
