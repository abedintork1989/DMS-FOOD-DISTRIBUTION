"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { getCustomers, getOrders } from "@/lib/storage";
import { money } from "@/lib/format";

export default function ReportsPage(){
  const [rows,setRows]=useState<{name:string;orders:number;sales:number}[]>([]);
  useEffect(()=>{
    const orders=getOrders();
    const customers=getCustomers();
    setRows(customers.map(c=>({name:c.name,orders:orders.filter(o=>o.customerId===c.id).length,sales:orders.filter(o=>o.customerId===c.id&&o.status!=="cancelled").reduce((s,o)=>s+o.total,0)})));
  },[]);
  return <AppShell>
    <PageHeader title="گزارش‌ها" subtitle="گزارش فروش بر اساس مشتری"/>
    <div className="panel table-wrap">
      <table><thead><tr><th>مشتری</th><th>تعداد سفارش</th><th>فروش</th></tr></thead><tbody>{rows.map(r=><tr key={r.name}><td>{r.name}</td><td>{r.orders}</td><td>{money(r.sales)}</td></tr>)}</tbody></table>
    </div>
  </AppShell>
}
