"use client";

import { useEffect, useState } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { getOrders } from "@/lib/storage";
import { money } from "@/lib/format";

function statusLabel(status: OrderStatus) {
  const map = {
    pending: ["در انتظار تایید", "warning"],
    approved: ["تایید شده", "success"],
    delivered: ["تحویل شده", "info"],
    cancelled: ["لغو شده", "danger"]
  } as const;
  return map[status];
}

export default function OrderTable() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => setOrders(getOrders().slice(0, 6)), []);

  return (
    <div className="panel">
      <div className="panel-title">
        <h2>آخرین سفارش‌ها</h2>
        <span className="page-subtitle">آخرین ۶ سفارش</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>شماره</th><th>مشتری</th><th>ویزیتور</th><th>مبلغ</th><th>وضعیت</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const [label, cls] = statusLabel(o.status);
              return (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.customerName}</td>
                  <td>{o.visitor}</td>
                  <td>{money(o.total)}</td>
                  <td><span className={`badge ${cls}`}>{label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!orders.length && <div className="empty">هنوز سفارشی ثبت نشده است.</div>}
      </div>
    </div>
  );
}
