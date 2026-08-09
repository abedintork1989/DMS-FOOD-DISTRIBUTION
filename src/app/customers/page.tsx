"use client";

import { useEffect, useState } from "react";
import { Eye, Trash2, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";


type Customer = {

  id:string;

  name:string;

  owner_name:string | null;

  phone:string | null;

  province:string | null;

  address:string | null;

  visitor:string | null;

  responsible:string | null;

  active:boolean | null;

};



export default function CustomersPage(){


const router = useRouter();



const [customers,setCustomers]=
useState<Customer[]>([]);



const [loading,setLoading]=
useState(true);



const [search,setSearch]=
useState("");




useEffect(()=>{

loadCustomers();

},[]);





async function loadCustomers(){


setLoading(true);



const {data,error}=await supabase

.from("customers")

.select(`

id,

name,

owner_name,

phone,

province,

address,

visitor,

responsible,

active

`)

.order("name");



if(error){

console.error(error);

alert(
"خطا در دریافت مشتریان:\n"+
error.message
);

setLoading(false);

return;

}



setCustomers(data || []);



setLoading(false);


}







async function deleteCustomer(id:string){



const ok =
confirm(
"آیا از حذف این مشتری مطمئن هستید؟"
);



if(!ok)
return;



const {error}=await supabase

.from("customers")

.delete()

.eq("id",id);





if(error){


alert(

"خطا در حذف مشتری:\n"+
error.message

);


return;

}





alert("مشتری حذف شد");



loadCustomers();



}






function openCustomer(id:string){



if(!id){

alert(
"شناسه مشتری وجود ندارد"
);

return;

}



router.push(
`/customers/${id}`
);



}






const filteredCustomers =

customers.filter(c=>{


const text =

[

c.name,

c.owner_name,

c.phone,

c.province,

c.visitor

]

.filter(Boolean)

.join(" ")

.toLowerCase();



return text.includes(
search.toLowerCase()
);



});







return (

<AppShell>



<PageHeader

title="مشتریان"

subtitle="مدیریت اطلاعات مشتریان"

/>





<div className="panel">



<div
style={{
position:"relative",
marginBottom:20
}}
>



<Search

size={18}

style={{

position:"absolute",

right:12,

top:12,

color:"#94a3b8"

}}

/>



<input

className="input"

style={{

paddingRight:40

}}

placeholder="جستجوی مشتری..."

value={search}

onChange={(e)=>

setSearch(
e.target.value
)

}

/>



</div>







<div className="table-wrap">



{

loading ?


<div
style={{
padding:40,
textAlign:"center"
}}
>

در حال دریافت اطلاعات...

</div>


:

<table>



<thead>


<tr>


<th>
نام مشتری
</th>


<th>
مالک
</th>


<th>
تلفن
</th>


<th>
استان
</th>


<th>
ویزیتور
</th>


<th>
وضعیت
</th>


<th>
عملیات
</th>


</tr>


</thead>







<tbody>



{


filteredCustomers.map(customer=>(



<tr


key={customer.id}



style={{

cursor:"pointer"

}}



onClick={()=>openCustomer(customer.id)}



>





<td>

<strong>

{customer.name}

</strong>


</td>





<td>

{
customer.owner_name || "-"
}


</td>





<td>

{
customer.phone || "-"
}


</td>





<td>

{
customer.province || "-"
}


</td>





<td>

{
customer.visitor || "-"
}


</td>






<td>



<span

className={

customer.active

?

"badge success"

:

"badge danger"

}

>


{

customer.active

?

"فعال"

:

"غیرفعال"

}


</span>



</td>







<td>



<div

style={{

display:"flex",

gap:8

}}

>





<button


className="btn btn-secondary btn-small"



onClick={(e)=>{


e.stopPropagation();



openCustomer(
customer.id
);



}}



>


<Eye size={15}/>

مشاهده


</button>







<button


className="btn btn-danger btn-small"



onClick={(e)=>{


e.stopPropagation();



deleteCustomer(
customer.id
);



}}



>


<Trash2 size={15}/>

حذف


</button>






</div>



</td>






</tr>



))



}







{

filteredCustomers.length===0 &&


<tr>


<td

colSpan={7}

style={{

textAlign:"center",

padding:30

}}

>


مشتری‌ای پیدا نشد


</td>


</tr>



}





</tbody>



</table>



}




</div>



</div>





</AppShell>


);


}