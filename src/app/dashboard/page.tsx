// dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  MapPin,
  ShoppingCart,
  DollarSign,
  WalletCards,
  ClipboardList,
} from "lucide-react";

import AppShell from "@/components/AppShell";
import { money, numberFa, todayLabel } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type Visitor = {
  id: string;
  full_name: string | null;
  active: boolean | null;
  tracking_enabled: boolean | null;
};

type Order = {
  id: string;
  invoice_total: number | null;
  status: string;
  created_at: string;
  customers?: { name?: string | null } | null;
};

export default function DashboardPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [visitorsResult, ordersResult] = await Promise.all([
      supabase
        .from("sales_visitors")
        .select("id,full_name,active,tracking_enabled"),

      supabase
        .from("orders")
        .select("id,invoice_total,status,created_at,customers(name)")
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false }),
    ]);

    setVisitors((visitorsResult.data ?? []) as Visitor[]);
    setOrders((ordersResult.data ?? []) as Order[]);

    setLoading(false);
  }

  const stats = useMemo(() => {
    const activeVisitors = visitors.filter(v => v.active).length;
    const trackingVisitors = visitors.filter(v => v.tracking_enabled).length;

    const sales = orders
      .filter(o => o.status === "approved" || o.status === "delivered")
      .reduce((sum, o) => sum + Number(o.invoice_total ?? 0), 0);

    return {
      activeVisitors,
      trackingVisitors,
      orders: orders.length,
      sales,
    };
  }, [visitors, orders]);

  return (
    <AppShell>
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-eyebrow">مرکز کنترل عملیات فروش</span>
          <h1>سلام، عابدین ترک 👋</h1>
          <p>وضعیت و عملکرد تیم فروش را در یک نگاه مدیریت کنید.</p>
        </div>

        <div className="dashboard-date">
          <span>امروز</span>
          <strong>{todayLabel()}</strong>
        </div>
      </section>

      <section className="dashboard-stats">
        <MetricCard title="ویزیتور فعال" value={numberFa(stats.activeVisitors)} icon={Users}/>
        <MetricCard title="ردیابی فعال" value={numberFa(stats.trackingVisitors)} icon={MapPin}/>
        <MetricCard title="سفارش امروز" value={numberFa(stats.orders)} icon={ShoppingCart}/>
        <MetricCard title="فروش امروز" value={money(stats.sales)} icon={DollarSign}/>
        <MetricCard title="وصول مطالبات" value="به‌زودی" icon={WalletCards}/>
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-panel">
          <div className="dashboard-panel-title">
            <h2>آخرین سفارش‌های امروز</h2>
          </div>

          {orders.slice(0, 8).map(order => (
            <div className="activity-item" key={order.id}>
              <div className="activity-icon">
                <ClipboardList size={18}/>
              </div>
              <div>
                <strong>
                  {order.customers?.name ?? "مشتری ثبت نشده"}
                </strong>
                <p>{money(Number(order.invoice_total ?? 0))}</p>
              </div>
            </div>
          ))}

          {!loading && orders.length === 0 && (
            <p className="empty">امروز سفارشی ثبت نشده است.</p>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-title">
            <h2>وضعیت تیم فروش</h2>
          </div>

          <p>
            کل ویزیتورها: {numberFa(visitors.length)}
          </p>
          <p>
            فعال: {numberFa(stats.activeVisitors)}
          </p>
          <p>
            دارای ردیابی: {numberFa(stats.trackingVisitors)}
          </p>
        </div>
      </section>
    </AppShell>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: any;
}) {
  return (
    <article className="dashboard-metric">
      <div className="metric-icon">
        <Icon size={21}/>
      </div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
