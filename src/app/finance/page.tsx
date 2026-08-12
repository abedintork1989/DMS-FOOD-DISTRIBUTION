"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import DataTable, { DataTableColumn } from "@/components/DataTable/DataTable";
import { supabase } from "@/lib/supabase";

type CustomerFinance = {
  customer_id: string;
  customer_name: string;
  province: string | null;
  total_debt: number;
};

function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function formatNumber(value: number) {
  return toPersianDigits(
    value.toLocaleString("en-US")
  );
}

function money(value: number) {
  return `${formatNumber(value)} ریال`;
}

export default function FinancePage() {
  const router = useRouter();

  const [data, setData] = useState<CustomerFinance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinance();
  }, []);

  async function loadFinance() {
    setLoading(true);

    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        customer_id,
        invoice_total,
        customers(
          name,
          province
        )
      `)
      .eq("status", "delivered");

    if (error) {
      console.error(error);
      alert(`خطا در دریافت اطلاعات مالی: ${error.message}`);
      setLoading(false);
      return;
    }

    const map = new Map<string, CustomerFinance>();

    (orders || []).forEach((order: any) => {
      const customerId = order.customer_id;

      if (!customerId) return;

      const old = map.get(customerId);

      if (old) {
        old.total_debt += Number(order.invoice_total || 0);
      } else {
        map.set(customerId, {
          customer_id: customerId,
          customer_name: order.customers?.name || "-",
          province: order.customers?.province || "-",
          total_debt: Number(order.invoice_total || 0),
        });
      }
    });

    setData(Array.from(map.values()));
    setLoading(false);
  }

  const columns = useMemo<DataTableColumn<CustomerFinance>[]>(
    () => [
      {
        key: "customer",
        title: "مشتری",
        width: 220,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) => row.customer_name,
      },
      {
        key: "province",
        title: "استان",
        width: 120,
        filterable: true,
        searchable: true,
        sortable: true,
        accessor: (row) => row.province || "-",
      },
      {
        key: "total_debt",
        title: "مجموع بدهی",
        width: 180,
        filterable: true,
        searchable: true,
        sortable: true,
        type: "number",
        accessor: (row) => row.total_debt,
        render: (value) => (
          <strong>{money(Number(value || 0))}</strong>
        ),
      },
      {
        key: "actions",
        title: "عملیات",
        width: 170,
        filterable: false,
        searchable: false,
        sortable: false,
        accessor: () => "",
        render: (_value, row) => (
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              router.push(`/finance/${row.customer_id}`)
            }
          >
            <Eye size={15} />
            مشاهده وضعیت مالی
          </button>
        ),
      },
    ],
    [router]
  );

  return (
    <AppShell>
      <PageHeader
        title="مالی"
        subtitle="مدیریت وضعیت مالی مشتریان"
      />

      <div className="panel">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            در حال دریافت اطلاعات مالی...
          </div>
        ) : data.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            بدهی ثبت شده‌ای وجود ندارد.
          </div>
        ) : (
          <DataTable
            data={data}
            columns={columns}
            rowKey={(row) => row.customer_id}
            pageSize={0}
            emptyText="اطلاعات مالی پیدا نشد."
          />
        )}
      </div>
    </AppShell>
  );
}
