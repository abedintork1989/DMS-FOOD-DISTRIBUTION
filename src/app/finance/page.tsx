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
  branch_count: number;
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

    const [
      { data: orders, error },
      { data: customerRows, error: customersError },
      { data: groupRows, error: groupsError },
      { data: payments, error: paymentsError },
      { data: marketingRows, error: marketingError },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select(`
          customer_id,
          invoice_total,
          customers(
            name,
            province,
            customer_group_id
          )
        `)
        .eq("status", "delivered"),

      supabase
        .from("customers")
        .select("id,name,province,customer_group_id"),

      supabase
        .from("customer_groups")
        .select("id,name,primary_customer_id"),

      supabase
        .from("payments")
        .select("customer_id,amount"),

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
    ]);

    if (error) {
      console.error(error);
      alert(`خطا در دریافت اطلاعات مالی: ${error.message}`);
      setLoading(false);
      return;
    }

    if (customersError) {
      console.error(customersError);
      alert(`خطا در دریافت مشتریان مالی: ${customersError.message}`);
      setLoading(false);
      return;
    }

    if (groupsError) {
      console.error(groupsError);
      alert(`خطا در دریافت مجموعه‌های مالی: ${groupsError.message}`);
      setLoading(false);
      return;
    }

    if (paymentsError) {
      console.error(paymentsError);
      alert(`خطا در دریافت پرداختی‌های مالی: ${paymentsError.message}`);
      setLoading(false);
      return;
    }

    if (marketingError) {
      console.error(marketingError);
      alert(`خطا در دریافت اطلاعات مارکتینگ: ${marketingError.message}`);
      setLoading(false);
      return;
    }

    const allCustomers = customerRows || [];
    const groups = groupRows || [];

    const groupMap = new Map(
      groups.map((group: any) => [group.id, group])
    );

    const customerMap = new Map(
      allCustomers.map((customer: any) => [customer.id, customer])
    );

    // دقیقاً مطابق منطق «مانده حساب» در صفحه دوم مالی:
    // مانده = مجموع فاکتورهای تحویل‌شده - مجموع پرداختی‌ها - مجموع هزینه‌های مارکتینگ
    //
    // برای مجموعه‌ها، مشتری مادر وارد محاسبات نمی‌شود و فقط شعب زیرمجموعه
    // در حساب مجموعه تجمیع می‌شوند.
    const invoiceMap = new Map<string, number>();
    const paymentMap = new Map<string, number>();
    const marketingMap = new Map<string, number>();

    (orders || []).forEach((order: any) => {
      const customer = customerMap.get(order.customer_id);
      if (!customer) return;

      const group = customer.customer_group_id
        ? groupMap.get(customer.customer_group_id)
        : null;

      if (group && customer.id === group.primary_customer_id) {
        return;
      }

      const parentId =
        group?.primary_customer_id || customer.id;

      invoiceMap.set(
        parentId,
        (invoiceMap.get(parentId) || 0) +
          Number(order.invoice_total || 0)
      );
    });

    (payments || []).forEach((payment: any) => {
      const customer = customerMap.get(payment.customer_id);
      if (!customer) return;

      const group = customer.customer_group_id
        ? groupMap.get(customer.customer_group_id)
        : null;

      // پرداخت‌های مشتری مادرِ یک مجموعه نیز در «مانده حساب» صفحه دوم مالی
      // محاسبه می‌شوند؛ چون ممکن است سند پرداخت روی مشتری مادر ثبت شده باشد
      // و فاکتورها روی شعبه‌ها باشند. پس پرداخت مشتری مادر نباید حذف شود.
      const parentId =
        group?.primary_customer_id || customer.id;

      paymentMap.set(
        parentId,
        (paymentMap.get(parentId) || 0) +
          Number(payment.amount || 0)
      );
    });

    (marketingRows || []).forEach((item: any) => {
      const customer = customerMap.get(item.customer_id);
      if (!customer) return;

      const group = customer.customer_group_id
        ? groupMap.get(customer.customer_group_id)
        : null;

      if (group && customer.id === group.primary_customer_id) {
        return;
      }

      const parentId =
        group?.primary_customer_id || customer.id;

      const totalMarketing =
        Number(item.shelf_rent || 0) +
        Number(item.tray_rent || 0) +
        Number(item.board_rent || 0) +
        Number(item.promoter_cost || 0) +
        Number(item.side_cost || 0) +
        Number(item.foc_amount || 0);

      marketingMap.set(
        parentId,
        (marketingMap.get(parentId) || 0) +
          totalMarketing
      );
    });

    const financeMap = new Map<string, CustomerFinance>();

    // ساخت ردیف‌های صفحه اول با همان مشتری/مجموعه‌هایی که قبلاً نمایش داده می‌شدند.
    (orders || []).forEach((order: any) => {
      const customer = customerMap.get(order.customer_id);

      if (!customer) return;

      const group = customer.customer_group_id
        ? groupMap.get(customer.customer_group_id)
        : null;

      if (
        group &&
        customer.id === group.primary_customer_id
      ) {
        return;
      }

      const parentId =
        group?.primary_customer_id || customer.id;

      const parentCustomer = customerMap.get(parentId);
      const parentName =
        group?.name ||
        parentCustomer?.name ||
        order.customers?.name ||
        "-";

      const branchCount = group
        ? allCustomers.filter(
            (c: any) =>
              c.customer_group_id === group.id &&
              c.id !== parentId
          ).length
        : 0;

      if (!financeMap.has(parentId)) {
        financeMap.set(parentId, {
          customer_id: parentId,
          customer_name: parentName,
          province:
            parentCustomer?.province ||
            order.customers?.province ||
            "-",
          total_debt: 0,
          branch_count: branchCount,
        });
      }
    });

    // مقدار ستون «مجموع بدهی» حالا دقیقاً همان «مانده حساب»
    // صفحه دوم مالی است.
    financeMap.forEach((row, parentId) => {
      row.total_debt =
        (invoiceMap.get(parentId) || 0) -
        (paymentMap.get(parentId) || 0) -
        (marketingMap.get(parentId) || 0);
    });

    setData(Array.from(financeMap.values()));
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
        key: "branch_count",
        title: "تعداد شعبه",
        width: 110,
        filterable: true,
        searchable: true,
        sortable: true,
        type: "number",
        accessor: (row) => row.branch_count,
        render: (value) => (
          <strong>{Number(value || 0).toLocaleString("fa-IR")}</strong>
        ),
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
        render: (value) => {
          const balance = Number(value || 0);

          return (
            <strong
              style={{
                color:
                  balance > 0
                    ? "#dc2626"
                    : balance < 0
                    ? "#16a34a"
                    : "#475569",
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              {(balance > 0 ? "- " : balance < 0 ? "+ " : "") +
                money(Math.abs(balance))}
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
        subtitle="نمای یکپارچه مالی مجموعه؛ مجموع مالی تمام شعب در همین صفحه"
      />

      <div
        style={{
          marginBottom: 14,
          padding: "12px 14px",
          borderRadius: 10,
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          color: "#1e3a8a",
          fontSize: 13,
        }}
      >
        در این صفحه هر مجموعه یک ردیف دارد و تمام اطلاعات مالی شعب آن مجموعه
        به‌صورت یکپارچه در همان پرونده محاسبه و نمایش داده می‌شود.
      </div>

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
