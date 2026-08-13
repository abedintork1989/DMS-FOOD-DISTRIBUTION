"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Eye, FileImage, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import DataTable, { DataTableColumn } from "@/components/DataTable/DataTable";
import { supabase } from "@/lib/supabase";

type CheckStatus = "not_due" | "due" | "cleared" | "received" | "returned" | null;

type CheckRow = {
  id: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  payment_date: string | null;
  check_number: string | null;
  sayadi_number: string | null;
  check_issue_date: string | null;
  check_due_date: string | null;
  check_status: CheckStatus;
  attachment_urls: string[];
  description: string | null;
  days_remaining: number | null;
};

const STATUS_META: Record<
  string,
  { label: string; color: string; background: string }
> = {
  not_due: {
    label: "عدم سررسید",
    color: "#a16207",
    background: "#fef3c7",
  },
  due: {
    label: "عدم وصول  ",
    color: "#b91c1c",
    background: "#fee2e2",
  },
  cleared: {
    label: "وصول شده",
    color: "#15803d",
    background: "#dcfce7",
  },
  received: {
    label: "عدم سررسید",
    color: "#a16207",
    background: "#fef3c7",
  },
  returned: {
    label: "برگشت خورده",
    color: "#b91c1c",
    background: "#fee2e2",
  },
};

function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function money(value: number) {
  return `${new Intl.NumberFormat("fa-IR").format(
    Math.abs(Number(value || 0))
  )} ریال`;
}

function gregorianToJalali(gy: number, gm: number, gd: number) {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

  let jy = gy > 1600 ? 979 : 0;
  gy = gy > 1600 ? gy - 1600 : gy - 621;

  const gy2 = gm > 2 ? gy + 1 : gy;

  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    gdm[gm - 1];

  jy += 33 * Math.floor(days / 12053);
  days %= 12053;

  jy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const jm =
    days < 186
      ? 1 + Math.floor(days / 31)
      : 7 + Math.floor((days - 186) / 30);

  const jd =
    1 + (days < 186 ? days % 31 : (days - 186) % 30);

  return { jy, jm, jd };
}

function formatGregorianAsJalali(value: string | null) {
  if (!value) return "-";

  const raw = String(value).substring(0, 10);
  const [gy, gm, gd] = raw.split("-").map(Number);

  if (!gy || !gm || !gd) return "-";

  const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);

  return `${toPersianDigits(jy)}/${toPersianDigits(
    String(jm).padStart(2, "0")
  )}/${toPersianDigits(String(jd).padStart(2, "0"))}`;
}

function dateOnlyUtc(value: Date) {
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
}

function daysBetweenTodayAndDueDate(value: string | null) {
  if (!value) return null;

  const [gy, gm, gd] = String(value).substring(0, 10).split("-").map(Number);

  if (!gy || !gm || !gd) return null;

  const dueUtc = Date.UTC(gy, gm - 1, gd);
  const today = new Date();
  const todayUtc = dateOnlyUtc(today);

  return Math.round((dueUtc - todayUtc) / 86400000);
}

function statusMeta(status: CheckStatus) {
  return STATUS_META[String(status || "not_due")] || STATUS_META.not_due;
}

function remainingMeta(days: number | null) {
  if (days === null) {
    return {
      label: "-",
      color: "#64748b",
      background: "#f8fafc",
    };
  }

  if (days > 0) {
    return {
      label: `${toPersianDigits(days)} روز`,
      color: "#15803d",
      background: "#dcfce7",
    };
  }

  if (days === 0) {
    return {
      label: "امروز",
      color: "#b45309",
      background: "#fef3c7",
    };
  }

  return {
    label: `${toPersianDigits(Math.abs(days))} روز گذشته`,
    color: "#b91c1c",
    background: "#fee2e2",
  };
}

export default function ChecksPage() {
  const router = useRouter();

  const [data, setData] = useState<CheckRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChecks();
  }, []);

  async function loadChecks() {
    setLoading(true);

    try {
      const { data: payments, error } = await supabase
        .from("payments")
        .select(`
          id,
          customer_id,
          amount,
          payment_date,
          check_number,
          sayadi_number,
          check_issue_date,
          check_due_date,
          check_status,
          attachment_urls,
          description,
          customers(
            name
          )
        `)
        .eq("payment_type", "check")
        .order("check_due_date", { ascending: true });

      if (error) throw error;

      const rows: CheckRow[] = (payments || []).map((payment: any) => ({
        id: payment.id,
        customer_id: payment.customer_id,
        customer_name: payment.customers?.name || "-",
        amount: Number(payment.amount || 0),
        payment_date: payment.payment_date || null,
        check_number: payment.check_number || null,
        sayadi_number: payment.sayadi_number || null,
        check_issue_date: payment.check_issue_date || null,
        check_due_date: payment.check_due_date || null,
        check_status: (payment.check_status || "not_due") as CheckStatus,
        attachment_urls: Array.isArray(payment.attachment_urls)
          ? payment.attachment_urls
          : [],
        description: payment.description || null,
        days_remaining: daysBetweenTodayAndDueDate(
          payment.check_due_date || null
        ),
      }));

      setData(rows);
    } catch (error: any) {
      console.error("CHECKS LOAD ERROR:", error);
      alert(
        `خطا در دریافت لیست چک‌ها: ${
          error?.message || "خطای نامشخص"
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  const columns = useMemo<DataTableColumn<CheckRow>[]>(
    () => [
      {
        key: "customer_name",
        title: "مشتری",
        width: 150,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) => row.customer_name,
      },
      {
        key: "amount",
        title: "مبلغ",
        width: 130,
        filterable: true,
        searchable: true,
        sortable: true,
        type: "number",
        accessor: (row) => row.amount,
        render: (value) => <strong>{money(Number(value || 0))}</strong>,
      },
      {
        key: "payment_date",
        title: "تاریخ دریافت",
        width: 120,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) => formatGregorianAsJalali(row.payment_date),
      },
      {
        key: "sayadi_number",
        title: "شناسه صیادی",
        width: 145,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) => toPersianDigits(row.sayadi_number || "-"),
      },
      {
        key: "check_due_date",
        title: "تاریخ وصول",
        width: 120,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) => formatGregorianAsJalali(row.check_due_date),
      },
      {
        key: "check_status",
        title: "وضعیت چک",
        width: 115,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) => statusMeta(row.check_status).label,
        render: (_value, row) => {
          const meta = statusMeta(row.check_status);

          return (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "5px 10px",
                borderRadius: 999,
                background: meta.background,
                color: meta.color,
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {meta.label}
            </span>
          );
        },
      },
      {
        key: "days_remaining",
        title: "روز مانده به سررسید",
        width: 125,
        filterable: true,
        searchable: true,
        sortable: true,
        type: "number",
        accessor: (row) => row.days_remaining ?? -999999,
        render: (_value, row) => {
          // چک وصول‌شده دیگر روز مانده به سررسید ندارد.
          if (row.check_status === "cleared") {
            return <span style={{ color: "#94a3b8" }}>—</span>;
          }

          const days = row.days_remaining;

          if (days === null) {
            return <span style={{ color: "#94a3b8" }}>—</span>;
          }

          // تاریخ امروز از سررسید گذشته و چک هنوز وصول نشده:
          // عدد منفی با رنگ قرمز نمایش داده می‌شود.
          if (days < 0) {
            return (
              <span
                style={{
                  color: "#dc2626",
                  fontWeight: 800,
                }}
              >
                {toPersianDigits(days)}
              </span>
            );
          }

          const meta = remainingMeta(days);

          return (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "5px 10px",
                borderRadius: 999,
                background: meta.background,
                color: meta.color,
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {meta.label}
            </span>
          );
        },
      },
      {
        key: "attachments",
        title: "ضمیمه سند پرداختی",
        width: 135,
        filterable: false,
        searchable: false,
        sortable: false,
        accessor: (row) => row.attachment_urls.length,
        render: (_value, row) => {
          if (!row.attachment_urls.length) {
            return <span style={{ color: "#94a3b8" }}>—</span>;
          }

          return (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                alignItems: "flex-start",
              }}
            >
              {row.attachment_urls.map((url, index) => {
                const isPdf = url.toLowerCase().includes(".pdf");

                return (
                  <a
                    key={`${url}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-small"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {isPdf ? (
                      <FileText size={14} />
                    ) : (
                      <FileImage size={14} />
                    )}
                    فایل {toPersianDigits(index + 1)}
                    <ExternalLink size={13} />
                  </a>
                );
              })}
            </div>
          );
        },
      },
      {
        key: "actions",
        title: "عملیات",
        width: 105,
        filterable: false,
        searchable: false,
        sortable: false,
        accessor: () => "",
        render: (_value, row) => (
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => router.push(`/finance/${row.customer_id}`)}
          >
            <Eye size={15} />
            مشاهده مشتری
          </button>
        ),
      },
    ],
    [router]
  );

  return (
    <AppShell>
      <style jsx global>{`
        .checks-page {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .checks-page .checks-table-panel {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          overflow: visible !important;
        }

        .checks-page .table-wrap {
          width: 100% !important;
          max-width: 100% !important;
          overflow: visible !important;
        }

        .checks-page .table-wrap > div {
          width: 100% !important;
          max-width: 100% !important;
          overflow: visible !important;
        }

        .checks-page table {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
        }

        .checks-page th,
        .checks-page td {
          padding: 7px 5px !important;
          font-size: clamp(10px, 0.78vw, 13px) !important;
          line-height: 1.35 !important;
          box-sizing: border-box !important;
          white-space: nowrap;
        }

        .checks-page th {
          position: relative !important;
          overflow: visible !important;
          z-index: 20 !important;
        }

        .checks-page td {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .checks-page th [role="dialog"],
        .checks-page th [data-radix-popper-content-wrapper],
        .checks-page th .filter-menu,
        .checks-page th .filter-dropdown {
          z-index: 99999 !important;
        }

        .checks-page th:nth-child(1),
        .checks-page td:nth-child(1) { width: 15% !important; }

        .checks-page th:nth-child(2),
        .checks-page td:nth-child(2) { width: 12% !important; }

        .checks-page th:nth-child(3),
        .checks-page td:nth-child(3) { width: 11% !important; }

        .checks-page th:nth-child(4),
        .checks-page td:nth-child(4) { width: 14% !important; }

        .checks-page th:nth-child(5),
        .checks-page td:nth-child(5) { width: 10% !important; }

        .checks-page th:nth-child(6),
        .checks-page td:nth-child(6) { width: 10% !important; }

        .checks-page th:nth-child(7),
        .checks-page td:nth-child(7) { width: 13% !important; }

        .checks-page th:nth-child(8),
        .checks-page td:nth-child(8) { width: 10% !important; }

        .checks-page th:nth-child(9),
        .checks-page td:nth-child(9) { width: 10% !important; }
      `}</style>

      <div className="checks-page">
        <PageHeader
          title="مدیریت چک ها"
          subtitle="مدیریت چک‌های دریافتی مشتریان"
        />

        <div className="panel checks-table-panel">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            در حال دریافت اطلاعات چک‌ها...
          </div>
        ) : data.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            چک ثبت‌شده‌ای وجود ندارد.
          </div>
        ) : (
          <DataTable
            data={data}
            columns={columns}
            rowKey={(row) => row.id}
            pageSize={0}
            emptyText="چکی پیدا نشد."
          />
        )}
        </div>
      </div>
    </AppShell>
  );
}
