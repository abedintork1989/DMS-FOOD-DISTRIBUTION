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
  total_debt: number; // مانده حساب مشتری
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

    const onFocus = () => {
      loadFinance();
    };

    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function loadFinance() {
    setLoading(true);

    try {
      const [
        ordersResult,
        paymentsResult,
        marketingResult,
        allocationsResult,
      ] = await Promise.all([
        supabase
          .from("orders")
          .select(`
            customer_id,
            invoice_total
          `)
          .eq("status", "delivered"),

        supabase
          .from("payments")
          .select(`
            customer_id,
            amount
          `),

        supabase
          .from("customer_marketing")
          .select(`
            customer_id,
            shelf_rent,
            tray_rent,
            board_rent,
            promoter_cost,
            side_cost,
            foc_amount
          `),

        supabase
          .from("payment_allocations")
          .select(`
            customer_id,
            amount
          `),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (marketingResult.error) throw marketingResult.error;
      if (allocationsResult.error) throw allocationsResult.error;

      const map = new Map<string, CustomerFinance>();

      // بدهی اولیه = مجموع فاکتورهای تحویل شده
      (ordersResult.data || []).forEach((order: any) => {
        if (!order.customer_id) return;

        const old = map.get(order.customer_id);

        if (old) {
          old.total_debt -= Number(order.invoice_total || 0);
        } else {
          map.set(order.customer_id, {
            customer_id: order.customer_id,
            customer_name: "-",
            province: "-",
            total_debt: -Number(order.invoice_total || 0),
          });
        }
      });

      // مانده حساب:
      // مجموع پرداختی‌ها + مجموع مارکتینگ - مجموع فاکتورها
      // کاهش پرداختی‌های ثبت شده
      (paymentsResult.data || []).forEach((payment: any) => {
        const item = map.get(payment.customer_id);
        if (item) {
          item.total_debt += Number(payment.amount || 0);
        }
      });

      // کاهش مارکتینگ‌های ثبت شده
      (marketingResult.data || []).forEach((marketing: any) => {
        const item = map.get(marketing.customer_id);

        if (item) {
          const marketingAmount =
            Number(marketing.shelf_rent || 0) +
            Number(marketing.tray_rent || 0) +
            Number(marketing.board_rent || 0) +
            Number(marketing.promoter_cost || 0) +
            Number(marketing.side_cost || 0) +
            Number(marketing.foc_amount || 0);

          item.total_debt += marketingAmount;
        }
      });

      // اطلاعات مشتریان
      const customerIds = Array.from(map.keys());

      if (customerIds.length) {
        const { data: customers, error: customersError } = await supabase
          .from("customers")
          .select("id,name,province")
          .in("id", customerIds);

        if (customersError) throw customersError;

        (customers || []).forEach((customer: any) => {
          const item = map.get(customer.id);

          if (item) {
            item.customer_name = customer.name || "-";
            item.province = customer.province || "-";
          }
        });
      }

      // مانده حساب باید با علامت واقعی خودش حفظ شود؛
      // مقدار مثبت یعنی مانده مثبت و با رنگ سبز نمایش داده می‌شود.
      const result = Array.from(map.values()).map((item) => ({
        ...item,
        total_debt: Number(item.total_debt || 0),
      }));

      setData(result);

    } catch (error: any) {
      console.error(error);
      alert(`خطا در دریافت اطلاعات مالی: ${error.message}`);
    } finally {
      setLoading(false);
    }
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
        title: "مانده حساب",
        width: 180,
        filterable: true,
        searchable: true,
        sortable: true,
        type: "number",
        accessor: (row) => row.total_debt,
        render: (value) => {
          const balance = Number(value || 0);

          if (balance === 0) {
            return (
              <strong style={{ color: "#64748b" }}>
                ۰ ریال
              </strong>
            );
          }

          return (
            <strong
              style={{
                color: balance > 0 ? "#16a34a" : "#dc2626",
              }}
            >
              {balance > 0 ? "+ " : "- "}
              {money(Math.abs(balance))}
            </strong>
          );
        },
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
