"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";


type Customer = {

id:string;

name:string;

phone:string | null;

address:string | null;

province:string | null;

responsible:string | null;

visitor:string | null;

entry_fee:number;

default_discount_percent:number;

};



const emptyCustomer:Customer={

id:"",

name:"",

phone:"",

address:"",

province:"",

responsible:"",

visitor:"",

entry_fee:0,

default_discount_percent:0

};





export default function CustomersPage(){


const [customers,setCustomers]=useState<Customer[]>([]);

const [form,setForm]=useState<Customer>(emptyCustomer);

const [modal,setModal]=useState(false);

const [search,setSearch]=useState("");

const [loading,setLoading]=useState(true);





useEffect(()=>{

loadCustomers();

},[]);





async function loadCustomers(){


setLoading(true);


const {data,error}=await supabase

.from("customers")

.select("*")

.order("created_at",{ascending:false});



if(error){

alert(error.message);

setLoading(false);

return;

}


setCustomers(data || []);

setLoading(false);


}







function openNew(){


setForm({

...emptyCustomer,

id:""

});


setModal(true);


}






function edit(customer:Customer){


setForm(customer);

setModal(true);


}








async function save(){


if(!form.name.trim()){

alert("نام فروشگاه الزامی است");

return;

}



let error;



if(form.id){


const result=await supabase

.from("customers")

.update({

name:form.name,

phone:form.phone,

address:form.address,

province:form.province,

responsible:form.responsible,

visitor:form.visitor,

entry_fee:Number(form.entry_fee),

default_discount_percent:Number(form.default_discount_percent)

})

.eq("id",form.id);



error=result.error;


}

else{


const result=await supabase

.from("customers")

.insert({

name:form.name,

phone:form.phone,

address:form.address,

province:form.province,

responsible:form.responsible,

visitor:form.visitor,

entry_fee:Number(form.entry_fee),

default_discount_percent:Number(form.default_discount_percent)

});


error=result.error;


}






if(error){

alert(error.message);

return;

}



setModal(false);

loadCustomers();


}









async function remove(id:string){


if(!confirm("این مشتری حذف شود؟"))

return;



const {error}=await supabase

.from("customers")

.delete()

.eq("id",id);



if(error){

alert(error.message);

return;

}



loadCustomers();


}







function money(value:number){

return new Intl.NumberFormat("fa-IR")

.format(value || 0);

}







const filtered=customers.filter(c=>{


const text=(

c.name+

c.phone+

c.province+

c.visitor+

c.responsible

).toLowerCase();



return text.includes(search.toLowerCase());


});







return (

<AppShell>


<PageHeader

title="مشتریان"

subtitle="مدیریت اطلاعات مشتریان"

action={

<button

className="btn btn-primary"

onClick={openNew}

>

<Plus size={16}/>

مشتری جدید

</button>

}

/>






<div className="panel">


<div className="toolbar">


<div style={{position:"relative"}}>


<Search

size={16}

style={{

position:"absolute",

right:10,

top:12

}}

/>


<input

className="input"

style={{paddingRight:35}}

placeholder="جستجوی مشتری..."

value={search}

onChange={e=>setSearch(e.target.value)}

/>


</div>


</div>






<div className="table-wrap">


{

loading ?

<div className="empty">

در حال دریافت اطلاعات...

</div>

:

<table>


<thead>

<tr>

<th>فروشگاه</th>

<th>مسئول</th>

<th>تلفن</th>

<th>استان</th>

<th>ویزیتور</th>

<th>ورودیه</th>

<th>تخفیف</th>

<th>عملیات</th>

</tr>

</thead>




<tbody>


{

filtered.map(c=>(


<tr key={c.id}>


<td>{c.name}</td>


<td>{c.responsible}</td>


<td>{c.phone}</td>


<td>{c.province}</td>


<td>{c.visitor}</td>


<td>{money(c.entry_fee)}</td>


<td>{c.default_discount_percent}%</td>



<td>


<div className="action-row">


<button

className="btn btn-secondary btn-small"

onClick={()=>edit(c)}

>

<Pencil size={14}/>

</button>



<button

className="btn btn-danger btn-small"

onClick={()=>remove(c.id)}

>

<Trash2 size={14}/>

</button>



</div>


</td>


</tr>


))


}



</tbody>


</table>


}


</div>


</div>










{

modal &&


<div className="modal-backdrop">


<div className="modal">


<div className="modal-header">


<h2>

{

form.id ?

"ویرایش مشتری"

:

"مشتری جدید"

}

</h2>



<button

className="close-btn"

onClick={()=>setModal(false)}

>

×

</button>


</div>





<div className="form-grid">



{

[

["name","نام فروشگاه"],

["responsible","مسئول"],

["phone","شماره تماس"],

["province","استان"],

["visitor","ویزیتور"]

].map(([key,label])=>(


<div className="form-field" key={key}>


<label>{label}</label>


<input

className="input"

value={(form as any)[key] || ""}

onChange={e=>

setForm({

...form,

[key]:e.target.value

})

}

/>


</div>


))


}






<div className="form-field">


<label>

مبلغ ورودیه

</label>


<input

className="input"

type="number"

value={form.entry_fee}

onChange={e=>

setForm({

...form,

entry_fee:Number(e.target.value)

})

}

/>


</div>







<div className="form-field">


<label>

درصد تخفیف پایه

</label>


<input

className="input"

type="number"

value={form.default_discount_percent}

onChange={e=>

setForm({

...form,

default_discount_percent:Number(e.target.value)

})

}

/>


</div>







<div className="form-field full">


<label>

آدرس

</label>


<textarea

className="textarea"

rows={3}

value={form.address || ""}

onChange={e=>

setForm({

...form,

address:e.target.value

})

}

/>


</div>




</div>






<div className="action-row">


<button

className="btn btn-primary"

onClick={save}

>

ذخیره

</button>


<button

className="btn btn-secondary"

onClick={()=>setModal(false)}

>

انصراف

</button>


</div>




</div>


</div>


}



</AppShell>


);


}