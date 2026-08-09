


"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";





export default function OrderDetailPage() {

  const params = useParams();
  const router = useRouter();

  const id = params.id as string;


  const [order,setOrder] = useState<any>(null);
  const [loading,setLoading] = useState(true);

const [isEditing, setIsEditing] = useState(false);


const [editedItems, setEditedItems] = useState<any[]>([]);

  useEffect(()=>{

    if(id){
      loadOrder();
    }

  },[id]);



async function loadOrder(){

const { data: { session } } = await supabase.auth.getSession();
console.log("SESSION:", session);

const { data: order, error: orderError } = await supabase
  .from("orders")
  .select(`
    *,
    customers(
      name,
      visitor
    )
  `)
  .eq("id", id)
  .single();


if (orderError) {
  console.log(orderError);
  return;
}


const { data: items, error: itemsError } = await supabase
  .from("order_items")
  .select(`
    *,
    products(
      name,
      barcode,
      category,
      quantity_per_carton
    )
  `)
  .eq("order_id", id);


if (itemsError) {
  console.log(itemsError);
  return;
}


const data = {
  ...order,
  order_items: items || []
};


console.log("FINAL DETAIL:", data);





if(orderError){

console.log(orderError);

return;

}






if(itemsError){

console.log(itemsError);

return;

}



const finalData = {
   ...order,
   order_items: items || []
};



console.log("FINAL DETAIL:",finalData);


setOrder(finalData);
setEditedItems(data.order_items || []);

setLoading(false);


}




  if(loading){

    return <div>در حال بارگذاری...</div>

  }



  if(!order){

    return <div>سفارش پیدا نشد</div>

  }





return (

<AppShell>


<PageHeader

title={`جزئیات سفارش ${order.order_number || ""}`}

subtitle="مشاهده کامل اطلاعات سفارش"

/>




<div className="panel">


<h3>
اطلاعات سفارش
</h3>


<div style={{
display:"grid",
gridTemplateColumns:"repeat(2,1fr)",
gap:20
}}>


<div>

<strong>
مشتری:
</strong>

<br/>

{order.customers?.name || "-"}

</div>



<div>

<strong>
ویزیتور:
</strong>

<br/>

{order.customers?.visitor || "-"}

</div>




<div>

<strong>
وضعیت:
</strong>

<br/>

{order.status}

</div>



<div>

<strong>
تاریخ ثبت:
</strong>

<br/>

{new Date(order.created_at)
.toLocaleDateString("fa-IR")}

</div>


</div>





<hr
style={{
margin:"30px 0"
}}
/>


<button

className="btn btn-primary"

onClick={()=>setIsEditing(true)}

>

✏️ ویرایش سفارش

</button>


<h3>
کالاهای سفارش
</h3>



<div className="table-wrap">


<table>


<thead>

<tr>

<th>
ردیف
</th>


<th>
بارکد
</th>


<th>
کالا
</th>


<th>تعداد کارتن </th>


<th>
تعداد جزء
</th>


<th>
قیمت مصرف کننده
</th>


<th>
تخفیف
</th>


<th>
قیمت نهایی
</th>


<th>
جمع
</th>


</tr>


</thead>



<tbody>


{

order.order_items?.map((item:any,index:number)=>(


<tr key={item.id}>


<td>
{index+1}
</td>


<td>

{item.products?.barcode || "-"}

</td>



<td>

{item.products?.name || "-"}

</td>



<td>

<td>

{
isEditing ?

<input

type="number"

value={
Math.ceil(
item.quantity / item.products?.quantity_per_carton
)
}

onChange={(e)=>{

const carton = Number(e.target.value);

const newQuantity =
carton * item.products.quantity_per_carton;


const newItems = editedItems.map((x:any)=>{

if(x.id === item.id){

return {
...x,
quantity:newQuantity
}

}

return x;

});


setEditedItems(newItems);

}}

style={{
width:"80px"
}}

/>

:

Math.ceil(
item.quantity / item.products?.quantity_per_carton
)

}

</td>

</td>



<td>
  {item.quantity}
</td>




<td>

{Number(item.consumer_price)
.toLocaleString()}

</td>



<td>

{item.discount_percent} %

</td>



<td>

{Number(item.final_price)
.toLocaleString()}

</td>



<td>

{Number(item.total_purchase_price)
.toLocaleString()}

</td>



</tr>


))

}


</tbody>


</table>


</div>






<div
style={{
marginTop:30,
fontSize:20,
fontWeight:"bold"
}}
>


جمع کل سفارش:

&nbsp;

{

Number(order.invoice_total)
.toLocaleString()

}

&nbsp;

ریال


</div>






<button

className="btn btn-secondary"

style={{
marginTop:30
}}

onClick={()=>router.back()}

>

بازگشت

</button>




</div>


</AppShell>

)


}