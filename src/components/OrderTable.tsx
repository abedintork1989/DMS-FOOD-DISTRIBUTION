"use client";

import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { money } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type Order = { id: string; order_number?: string | number | null; customer_name?: string | null; status: string; invoice_total?: number | null; created_at: string; customers?: { name?: string | null } | null };
function statusInfo(status: string) { const labels: Record<string, [string, string]> = { pending: ["در انتظار تأیید", "pending"], approved: ["تأیید شده", "approved"], delivered: ["تحویل شده", "delivered"], cancelled: ["لغو شده", "cancelled"] }; return labels[status] ?? [status, "approved"]; }

export default function OrderTable() {
  const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { void loadOrders(); }, []);
  async function loadOrders() { const { data, error } = await supabase.from("orders").select("*, customers(name)").order("created_at", { ascending: false }).limit(6); if (!error) setOrders((data ?? []) as Order[]); setLoading(false); }
  return <section className="dashboard-panel dashboard-orders"><div className="dashboard-panel-title"><div><span>پیگیری عملیات</span><h2>آخرین سفارش‌ها</h2></div><Link href="/orders" className="view-all">مشاهده همه <ArrowLeft size={15} /></Link></div><div className="dashboard-order-table"><table><thead><tr><th>شماره سفارش</th><th>مشتری</th><th>مبلغ</th><th>وضعیت</th><th>جزئیات</th></tr></thead><tbody>{orders.map((order) => { const [label, statusClass] = statusInfo(order.status); return <tr key={order.id}><td className="order-id">{order.order_number ?? order.id}</td><td>{order.customer_name ?? order.customers?.name ?? "-"}</td><td>{money(order.invoice_total)}</td><td><span className={`order-status ${statusClass}`}>{label}</span></td><td><Link href="/orders" className="order-view" aria-label="مشاهده سفارش"><Eye size={17} /></Link></td></tr>; })}</tbody></table>{loading && <div className="empty">در حال دریافت سفارش‌ها...</div>}{!loading && !orders.length && <div className="empty">هنوز سفارشی ثبت نشده است.</div>}</div></section>;
}
