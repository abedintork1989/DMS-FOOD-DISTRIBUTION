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
  delivery_date?: string | null;
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

// نمایش تاریخ تحویل دقیقاً مثل تاریخ ثبت سفارش بدون تبدیل اشتباه شمسی به میلادی
function formatDeliveryDate(value: string | null | undefined) {
  if (!value) return "-";

  const clean = String(value).trim();
  const datePart = clean.split(" ")[0];
  const parts = datePart.split("/");

  if (parts.length !== 3) return clean;

  const [year, month, day] = parts;

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

function warehouseStatus(status: string) {
  if (status === "delivered") {
    return { label: "تحویل داده شد", className: "info" };
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
      .in("status", ["approved", "delivered"])
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
        accessor: (row) => warehouseStatus(row.status).label,
        render: (_value, row) => {
          const status = warehouseStatus(row.status);
          return <span className={`badge ${status.className}`}>{status.label}</span>;
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
              مشاهده / ویرایش
            </button>


          </div>
        ),
      },
    ],
    [router]
  );

  return (
    <AppShell>
      <PageHeader
        title="انبار"
        subtitle="مدیریت سفارش‌های تأییدشده و تحویل سفارشات"
      />

      <div className="panel">
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
            هنوز سفارش تأییدشده‌ای وارد انبار نشده است.
          </div>
        ) : (
          <DataTable
            data={orders}
            columns={columns}
            rowKey={(order) => order.id}
            rowClassName={(order) => {
              if (order.status === "delivered") {
                return "warehouse-delivered-row";
              }

              if (order.status === "approved") {
                return "warehouse-approved-row";
              }

              return "";
            }}
            pageSize={0}
            emptyText="سفارشی در انبار پیدا نشد."
          />
        )}
      </div>
    </AppShell>
  );
}
