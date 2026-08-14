"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpLeft, Boxes, ClipboardList, DollarSign, Package, ShoppingCart, TrendingUp, Users, WalletCards } from "lucide-react";
import AppShell from "@/components/AppShell";
import OrderTable from "@/components/OrderTable";
import { money, numberFa, todayLabel } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type DashboardOrder = { id: string; order_number?: string | number | null; customer_name?: string | null; status: string; invoice_total?: number | null; created_at: string; customers?: { name?: string | null } | null };
type DashboardData = { customers: number; products: number; orders: DashboardOrder[] };
const orderAmount = (order: DashboardOrder) => Number(order.invoice_total || 0);

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({ customers: 0, products: 0, orders: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void loadDashboard();
    const refreshOnFocus = () => void loadDashboard();
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setLoadError("");

    const [customersResult, productsResult, ordersResult] = await Promise.all([
      supabase.from("customers").select("id, active"),
      supabase.from("products").select("id"),
      supabase
        .from("orders")
        .select("*, customers(name)")
        .order("created_at", { ascending: false }),
    ]);

    const errors = [customersResult.error, productsResult.error, ordersResult.error]
      .filter(Boolean)
      .map((error) => error?.message)
      .join(" | ");

    if (errors) {
      setLoadError(`خطا در دریافت آمار: ${errors}`);
    }

    const customers = (customersResult.data ?? []) as { id: string; active: boolean | null }[];
    setData({
      customers: customers.filter((customer) => customer.active !== false).length,
      products: (productsResult.data ?? []).length,
      orders: (ordersResult.data ?? []) as DashboardOrder[],
    });
    setLoading(false);
  }

  const stats = useMemo(() => {
    const approvedOrders = data.orders.filter((order) => order.status === "approved");
    const deliveredOrders = data.orders.filter((order) => order.status === "delivered");
    return {
      sales: approvedOrders.reduce((sum, order) => sum + orderAmount(order), 0),
      deliveredSales: deliveredOrders.reduce((sum, order) => sum + orderAmount(order), 0),
      pendingOrders: data.orders.filter((order) => order.status === "pending").length,
    };
  }, [data.orders]);

  return <AppShell>
    <section className="dashboard-hero"><div><span className="dashboard-eyebrow">نمای کلی عملکرد</span><h1>سلام، عابدین ترک <span>👋</span></h1><p>به سیستم مدیریت هوشمند فروش خوش آمدید؛ وضعیت کسب‌وکار شما در یک نگاه.</p></div><div className="dashboard-date"><span>امروز</span><strong>{todayLabel()}</strong></div><div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" /></section>
    {loadError && <div className="dashboard-load-error">{loadError}<button onClick={loadDashboard}>تلاش دوباره</button></div>}
    <section className="dashboard-stats" aria-label="آمار کلیدی">
      <MetricCard title="فروش ثبت‌شده" value={loading ? "..." : money(stats.sales)} icon={DollarSign} tone="green" detail={`${numberFa(data.orders.length)} سفارش ثبت شده`} />
      <MetricCard title="سفارش‌های در انتظار" value={loading ? "..." : numberFa(stats.pendingOrders)} icon={ShoppingCart} tone="amber" detail="نیازمند بررسی مدیر" />
      <MetricCard title="مشتریان فعال" value={loading ? "..." : numberFa(data.customers)} icon={Users} tone="blue" detail="از جدول مشتریان Supabase" />
      <MetricCard title="محصولات ثبت‌شده" value={loading ? "..." : numberFa(data.products)} icon={Boxes} tone="violet" detail="از جدول محصولات Supabase" />
      <MetricCard title="فروش تحویل‌شده" value={loading ? "..." : money(stats.deliveredSales)} icon={WalletCards} tone="mint" detail="بر اساس سفارش‌های تحویل‌شده" />
    </section>
    <section className="dashboard-main-grid"><OrderTable /><div className="dashboard-panel sales-overview"><div className="dashboard-panel-title"><div><span>خلاصه فروش</span><h2>عملکرد سفارش‌ها</h2></div><TrendingUp size={21} /></div><div className="sales-total"><span>فروش کل</span><strong>{loading ? "..." : money(stats.sales)}</strong></div><div className="sales-bars" aria-label="نمودار فروش">{[30, 46, 36, 66, 92, 61, 78].map((height, index) => <div key={index} className="sales-bar-column"><i style={{ height: `${height}%` }} /><span>{numberFa(index + 1)}</span></div>)}</div><p className="panel-note">نمودار نمایشی است؛ کارت‌ها و جدول سفارش‌ها از داده‌های واقعی Supabase خوانده می‌شوند.</p></div></section>
    <section className="dashboard-bottom-grid"><div className="dashboard-panel quick-actions"><div className="dashboard-panel-title"><div><span>عملیات روزانه</span><h2>دسترسی سریع</h2></div></div><div className="quick-actions-grid"><QuickLink href="/orders" label="سفارش جدید" icon={ShoppingCart} /><QuickLink href="/customers" label="مشتری جدید" icon={Users} /><QuickLink href="/products" label="کالای جدید" icon={Package} /><QuickLink href="/warehouse" label="گزارش موجودی" icon={Boxes} /></div></div><div className="dashboard-panel activity-panel"><div className="dashboard-panel-title"><div><span>آخرین تغییرات</span><h2>فعالیت‌های اخیر</h2></div></div>{data.orders.slice(0, 4).map((order) => <div className="activity-item" key={order.id}><div className="activity-icon"><ClipboardList size={18} /></div><div><strong>سفارش {order.order_number ?? order.id} ثبت شد</strong><p>{order.customer_name ?? order.customers?.name ?? "مشتری ثبت نشده"} · {money(orderAmount(order))}</p></div></div>)}{!loading && !data.orders.length && <p className="empty">هنوز فعالیتی ثبت نشده است.</p>}</div></section>
  </AppShell>;
}

function MetricCard({ title, value, icon: Icon, detail, tone }: { title: string; value: string; icon: any; detail: string; tone: string }) { return <article className={`dashboard-metric metric-${tone}`}><div className="metric-icon"><Icon size={21} /></div><div><span>{title}</span><strong>{value}</strong><small>{detail}</small></div></article>; }
function QuickLink({ href, label, icon: Icon }: { href: string; label: string; icon: any }) { return <Link href={href} className="quick-link"><Icon size={23} /><span>{label}</span><ArrowUpLeft size={15} /></Link>; }
