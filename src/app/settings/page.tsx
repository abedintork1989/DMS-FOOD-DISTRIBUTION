"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { resetDemoData } from "@/lib/storage";

export default function SettingsPage(){
  const [message,setMessage]=useState("");
  function reset(){
    if(!confirm("اطلاعات نمونه جایگزین اطلاعات فعلی شود؟"))return;
    resetDemoData();
    setMessage("اطلاعات نمونه بازنشانی شد. صفحات را یک بار تازه‌سازی کنید.");
  }
  return <AppShell>
    <PageHeader title="تنظیمات" subtitle="تنظیمات نسخه آزمایشی"/>
    <div className="panel">
      <h2 style={{fontSize:17}}>اطلاعات سیستم</h2>
      <p style={{color:"#64748b",lineHeight:2}}>این نسخه برای شروع و تست ابزار واقعی ساخته شده است. دیتابیس آنلاین هنوز متصل نشده است.</p>
      <button className="btn btn-secondary" onClick={reset}>بازنشانی داده‌های نمونه</button>
      {message&&<p style={{color:"#16a34a",fontSize:13}}>{message}</p>}
    </div>
  </AppShell>
}
