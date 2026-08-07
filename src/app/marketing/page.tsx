"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";

import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";



type Customer = {
  id:string;
  name:string;
  province:string;
  visitor:string;
};



type Marketing = {

id:string;

customer_id:string;

start_date:string;

end_date:string;

shelf_rent:number;

tray_rent:number;

board_rent:number;

promoter_cost:number;

side_cost:number;

foc_amount:number;

customers?:Customer;

};





const emptyForm={

customer_id:"",

start_date:"",

end_date:"",

shelf_rent:0,

tray_rent:0,

board_rent:0,

promoter_cost:0,

side_cost:0,

foc_amount:0

};





export default function MarketingPage(){



const [customers,setCustomers]=useState<Customer[]>([]);

const [items,setItems]=useState<Marketing[]>([]);

const [modal,setModal]=useState(false);

const [form,setForm]=useState<any>(emptyForm);





useEffect(()=>{

loadCustomers();

loadMarketing();

},[]);






async function loadCustomers(){


const {data,error}=await supabase

.from("customers")

.select("id,name,province,visitor")

.order("name");



if(error){

alert(error.message);

return;

}


setCustomers(data || []);

}







async function loadMarketing(){



const {data,error}=await supabase

.from("customer_marketing")

.select(`

*,

customers(

name,

province,

visitor

)

`)

.order("created_at",{ascending:false});



if(error){

alert(error.message);

return;

}


setItems(data || []);

}







function total(){


return (

Number(form.shelf_rent)+

Number(form.tray_rent)+

Number(form.board_rent)+

Number(form.promoter_cost)+

Number(form.side_cost)+

Number(form.foc_amount)

);


}







function money(v:number){

return new Intl.NumberFormat("fa-IR")
.format(v || 0);

}








function showDate(date:string){


if(!date) return "-";


return new Intl.DateTimeFormat(
"fa-IR"
).format(new Date(date));


}









async function save(){



if(!form.customer_id){

alert("فروشگاه را انتخاب کنید");

return;

}





const {error}=await supabase

.from("customer_marketing")

.insert({

customer_id:form.customer_id,

start_date:form.start_date,

end_date:form.end_date,

shelf_rent:Number(form.shelf_rent),

tray_rent:Number(form.tray_rent),

board_rent:Number(form.board_rent),

promoter_cost:Number(form.promoter_cost),

side_cost:Number(form.side_cost),

foc_amount:Number(form.foc_amount)

});





if(error){

alert(error.message);

return;

}




setModal(false);

setForm(emptyForm);

loadMarketing();



}









async function remove(id:string){


if(!confirm("حذف شود؟"))

return;



const {error}=await supabase

.from("customer_marketing")

.delete()

.eq("id",id);



if(error){

alert(error.message);

return;

}


loadMarketing();

}









return (

<AppShell>



<PageHeader

title="مارکتینگ مشتریان"

subtitle="مدیریت هزینه‌های حمایتی مشتریان"

action={

<button

className="btn btn-primary"

onClick={()=>setModal(true)}

>

<Plus size={16}/>

ثبت مارکتینگ

</button>

}

/>






<div className="panel table-wrap">


<table>

<thead>

<tr>

<th>فروشگاه</th>

<th>استان</th>

<th>ویزیتور</th>

<th>از تاریخ</th>

<th>تا تاریخ</th>

<th>سرلاین</th>

<th>سینی</th>

<th>تابلو</th>

<th>پروموت</th>

<th>جانبی</th>

<th>FOC</th>

<th>جمع کل</th>

<th>عملیات</th>

</tr>

</thead>



<tbody>


{

items.map(item=>(

<tr key={item.id}>


<td>{item.customers?.name}</td>

<td>{item.customers?.province}</td>

<td>{item.customers?.visitor}</td>


<td>{showDate(item.start_date)}</td>

<td>{showDate(item.end_date)}</td>


<td>{money(item.shelf_rent)}</td>

<td>{money(item.tray_rent)}</td>

<td>{money(item.board_rent)}</td>

<td>{money(item.promoter_cost)}</td>

<td>{money(item.side_cost)}</td>

<td>{money(item.foc_amount)}</td>


<td>

{money(

item.shelf_rent+

item.tray_rent+

item.board_rent+

item.promoter_cost+

item.side_cost+

item.foc_amount

)}

</td>



<td>

<button

className="btn btn-danger btn-small"

onClick={()=>remove(item.id)}

>

<Trash2 size={14}/>

</button>


</td>



</tr>

))


}



</tbody>


</table>


</div>









{modal &&

<div className="modal-backdrop">

<div className="modal">


<div className="modal-header">

<h2>

ثبت مارکتینگ

</h2>

<button

className="close-btn"

onClick={()=>setModal(false)}

>

×

</button>


</div>





<div className="form-grid">



<div className="form-field">

<label>فروشگاه</label>


<select

className="input"

value={form.customer_id}

onChange={e=>

setForm({

...form,

customer_id:e.target.value

})

}

>


<option value="">

انتخاب فروشگاه

</option>



{

customers.map(c=>(

<option

key={c.id}

value={c.id}

>

{c.name}

</option>


))

}


</select>

</div>








<div className="form-field">

<label>از تاریخ</label>


<DatePicker

calendar={persian}

locale={persian_fa}

inputClass="input"

onChange={(date:any)=>


setForm({

...form,

start_date:date?.format("YYYY-MM-DD")

})


}

/>


</div>





<div className="form-field">

<label>تا تاریخ</label>


<DatePicker

calendar={persian}

locale={persian_fa}

inputClass="input"

onChange={(date:any)=>


setForm({

...form,

end_date:date?.format("YYYY-MM-DD")

})


}

/>


</div>







{

[

["shelf_rent","اجاره سرلاین"],

["tray_rent","اجاره سینی"],

["board_rent","اجاره تابلو"],

["promoter_cost","هزینه نیروی پروموت"],

["side_cost","هزینه نیروی جانبی"],

["foc_amount","مبلغ FOC"]

].map(([key,label])=>(


<div className="form-field" key={key}>

<label>{label}</label>

<input

className="input"

type="number"

value={form[key]}

onChange={e=>

setForm({

...form,

[key]:Number(e.target.value)

})

}

/>

</div>


))


}



</div>






<h3>

جمع کل:

{money(total())}

تومان

</h3>






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