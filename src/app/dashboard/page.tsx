"use client";

import { useEffect, useState } from "react";
import { ClipboardList, DollarSign, Users, WalletCards } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import OrderTable from "@/components/OrderTable";
import { getCustomers, getOrders } from "@/lib/storage";
import { money } from "@/lib/format";

export default function DashboardPage() {
  const [stats, setStats] = useState({ customers: 0, orders: 0, sales: 0, receivable: 0 });

  useEffect(() => {
    const customers = getCustomers();
    const orders = getOrders();
    const sales = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
    setStats({ customers: customers.filter(c => c.active).length, orders: orders.length, sales, receivable: 0 });
  }, []);

  return (
    <AppShell>
      <PageHeader title="داشبورد مدیر" subtitle="نمای کلی وضعیت شرکت پخش" />
      <div className="card-grid">
        <StatCard title="مشتریان فعال" value={stats.customers.toLocaleString("fa-IR")} icon={Users} />
        <StatCard title="تعداد سفارش‌ها" value={stats.orders.toLocaleString("fa-IR")} icon={ClipboardList} />
        <StatCard title="فروش ثبت‌شده" value={money(stats.sales)} icon={DollarSign} />
        <StatCard title="مطالبات" value={money(stats.receivable)} icon={WalletCards} hint="در نسخه بعد به حسابداری واقعی متصل می‌شود" />
      </div>

      <div className="grid-2">
        <OrderTable />
        <div className="panel">
          <div className="panel-title"><h2>وضعیت فعلی سیستم</h2></div>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ padding: 14, background: "#f8fafc", borderRadius: 12 }}>ثبت مشتری: آماده</div>
            <div style={{ padding: 14, background: "#f8fafc", borderRadius: 12 }}>ثبت سفارش: آماده</div>
            <div style={{ padding: 14, background: "#f8fafc", borderRadius: 12 }}>تایید سفارش: آماده</div>
            <div style={{ padding: 14, background: "#fff7ed", borderRadius: 12 }}>دیتابیس آنلاین: در مرحله بعد</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
