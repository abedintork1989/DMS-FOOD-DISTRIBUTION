"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Eye, Plus, X } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import type { Customer, Order, OrderStatus, Product } from "@/lib/types";
import { getCustomers, getOrders, getProducts, saveOrders } from "@/lib/storage";
import { money } from "@/lib/format";

function statusLabel(status: OrderStatus) {
  const map = { pending: ["در انتظار تایید","warning"], approved:["تایید شده","success"], delivered:["تحویل شده","info"], cancelled:["لغو شده","danger"] } as const;
  return map[status];
}

export default function OrdersPage() {
  const [orders,setOrders]=useState<Order[]>([]);
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
  const [modal,setModal]=useState(false);
  const [detail,setDetail]=useState<Order|null>(null);
  const [customerId,setCustomerId]=useState("");
  const [visitor,setVisitor]=useState("رضا");
  const [quantities,setQuantities]=useState<Record<string,number>>({});

  useEffect(()=>{setOrders(getOrders());setCustomers(getCustomers());setProducts(getProducts())},[]);

  const total = useMemo(()=>products.reduce((sum,p)=>sum+(quantities[p.id]||0)*p.sellPrice,0),[products,quantities]);

  function createOrder(){
    const customer=customers.find(c=>c.id===customerId);
    if(!customer){alert("لطفاً مشتری را انتخاب کنید.");return}
    const items=products.filter(p=>(quantities[p.id]||0)>0).map(p=>({productId:p.id,productName:p.name,quantity:quantities[p.id],price:p.sellPrice}));
    if(!items.length){alert("حداقل یک کالا با تعداد بیشتر از صفر وارد کنید.");return}
    const cost=items.reduce((s,i)=>s+i.quantity*(products.find(p=>p.id===i.productId)?.buyPrice||0),0);
    const order:Order={id:`O${Date.now()}`,customerId,customerName:customer.name,visitor,createdAt:new Date().toISOString(),status:"pending",items,total,cost,extraCost:0,profit:total-cost};
    const next=[order,...orders];setOrders(next);saveOrders(next);setModal(false);setQuantities({});
  }

  function setStatus(id:string,status:OrderStatus){
    const next=orders.map(o=>o.id===id?{...o,status}:o);setOrders(next);saveOrders(next);
    if(detail?.id===id)setDetail({...detail,status});
  }

  return <AppShell>
    <PageHeader title="سفارشات" subtitle="کارتابل سفارش‌ها و ثبت سفارش جدید" action={<button className="btn btn-primary" onClick={()=>setModal(true)}><Plus size={16}/> ثبت سفارش</button>}/>
    <div className="panel table-wrap">
      <table><thead><tr><th>شماره</th><th>مشتری</th><th>ویزیتور</th><th>مبلغ</th><th>سود تقریبی</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody>{orders.map(o=>{const [label,cls]=statusLabel(o.status);return <tr key={o.id}><td>{o.id}</td><td>{o.customerName}</td><td>{o.visitor}</td><td>{money(o.total)}</td><td>{money(o.profit-o.extraCost)}</td><td><span className={`badge ${cls}`}>{label}</span></td><td><button className="btn btn-secondary btn-small" onClick={()=>setDetail(o)}><Eye size={14}/> مشاهده</button></td></tr>})}</tbody></table>
    </div>

    {modal&&<div className="modal-backdrop"><div className="modal">
      <div className="modal-header"><h2>ثبت سفارش</h2><button className="close-btn" onClick={()=>setModal(false)}>×</button></div>
      <div className="form-grid">
        <div className="form-field"><label>مشتری</label><select className="select" value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">انتخاب مشتری</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="form-field"><label>ویزیتور</label><input className="input" value={visitor} onChange={e=>setVisitor(e.target.value)}/></div>
      </div>
      <div style={{marginTop:20}}><h3 style={{fontSize:15}}>کالاها</h3><div style={{display:"grid",gap:8}}>{products.map(p=><div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 120px 150px",gap:10,alignItems:"center",padding:"9px 0",borderBottom:"1px solid #e2e8f0"}}><span>{p.name}</span><span style={{color:"#64748b",fontSize:12}}>{money(p.sellPrice)}</span><input className="input" type="number" min="0" placeholder="تعداد" value={quantities[p.id]||""} onChange={e=>setQuantities({...quantities,[p.id]:Number(e.target.value)})}/></div>)}</div></div>
      <div style={{marginTop:18,fontWeight:800}}>جمع سفارش: {money(total)}</div>
      <div className="action-row" style={{marginTop:18}}><button className="btn btn-primary" onClick={createOrder}>ارسال سفارش</button><button className="btn btn-secondary" onClick={()=>setModal(false)}>انصراف</button></div>
    </div></div>}

    {detail&&<div className="modal-backdrop"><div className="modal">
      <div className="modal-header"><h2>جزئیات {detail.id}</h2><button className="close-btn" onClick={()=>setDetail(null)}>×</button></div>
      <p><b>مشتری:</b> {detail.customerName}</p><p><b>ویزیتور:</b> {detail.visitor}</p>
      <div className="table-wrap"><table><thead><tr><th>کالا</th><th>تعداد</th><th>قیمت</th><th>جمع</th></tr></thead><tbody>{detail.items.map(i=><tr key={i.productId}><td>{i.productName}</td><td>{i.quantity}</td><td>{money(i.price)}</td><td>{money(i.price*i.quantity)}</td></tr>)}</tbody></table></div>
      <h3>جمع: {money(detail.total)}</h3>
      <div className="action-row">{detail.status==="pending"&&<button className="btn btn-success" onClick={()=>setStatus(detail.id,"approved")}><Check size={15}/> تایید سفارش</button>}{detail.status==="approved"&&<button className="btn btn-primary" onClick={()=>setStatus(detail.id,"delivered")}>تحویل شد</button>}{detail.status!=="delivered"&&detail.status!=="cancelled"&&<button className="btn btn-danger" onClick={()=>setStatus(detail.id,"cancelled")}><X size={15}/> لغو سفارش</button>}</div>
    </div></div>}
  </AppShell>
}
