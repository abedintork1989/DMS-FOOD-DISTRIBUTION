"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { getOrders } from "@/lib/storage";
import { money } from "@/lib/format";

export default function AccountingPage(){
  const [data,setData]=useState({sales:0,cost:0,extra:0,profit:0});
  useEffect(()=>{
    const orders=getOrders().filter(o=>o.status!=="cancelled");
    const sales=orders.reduce((s,o)=>s+o.total,0);
    const cost=orders.reduce((s,o)=>s+o.cost,0);
    const extra=orders.reduce((s,o)=>s+o.extraCost,0);
    setData({sales,cost,extra,profit:sales-cost-extra});
  },[]);
  return <AppShell>
    <PageHeader title="مالی و سود" subtitle="نمای ساده مالی سفارش‌های ثبت‌شده"/>
    <div className="card-grid">
      <StatCard title="فروش" value={money(data.sales)} icon={DollarSign}/>
      <StatCard title="بهای تمام‌شده" value={money(data.cost)} icon={TrendingDown}/>
      <StatCard title="هزینه‌های جانبی" value={money(data.extra)} icon={TrendingDown}/>
      <StatCard title="سود تقریبی" value={money(data.profit)} icon={TrendingUp}/>
    </div>
    <div className="panel" style={{marginTop:18}}>
      <h2 style={{fontSize:17}}>فرمول محاسبه سود</h2>
      <p style={{color:"#64748b",lineHeight:2}}>سود تقریبی = مبلغ فروش − بهای تمام‌شده کالا − هزینه‌های جانبی</p>
      <p style={{fontSize:12,color:"#94a3b8"}}>این بخش هنوز حسابداری کامل، دریافت/پرداخت و دفتر حساب ندارد و در نسخه بعد توسعه داده می‌شود.</p>
    </div>
  </AppShell>
}
