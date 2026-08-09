"use client";
import BackButton from "@/components/BackButton";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Trash2,
  Upload,
  Download,
  Plus,
  X,
  Save
} from "lucide-react";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";



type Customer = {

  id:string;

  name:string;

  owner_name:string | null;

  phone:string | null;

  address:string | null;

  province:string | null;

  responsible:string | null;

  visitor:string | null;

  entry_fee:number | null;

  notes:string | null;

};



type Discount = {

  id:string;

  category:string;

  discount_percent:number;

};



type Media = {

  id:string;

  media_type:string;

  image_url:string;

  created_at:string;

};



export default function CustomerDetailPage(){


const params = useParams();


const customerId =
 typeof params.id === "string"
 ? params.id
 : "";



const [customer,setCustomer]=
useState<Customer | null>(null);



const [discounts,setDiscounts]=
useState<Discount[]>([]);



const [categories,setCategories]=
useState<string[]>([]);



const [media,setMedia]=
useState<Media[]>([]);



const [loading,setLoading]=
useState(true);



const [edit,setEdit]=
useState(false);



const [discountCategory,setDiscountCategory]=
useState("");



const [discountPercent,setDiscountPercent]=
useState(0);



const [form,setForm]=useState({

name:"",

owner_name:"",

phone:"",

address:"",

province:"",

responsible:"",

visitor:"",

entry_fee:0,

notes:""

});



useEffect(()=>{


if(!customerId)
return;


loadCustomer();

loadDiscounts();

loadCategories();

loadMedia();


},[customerId]);



async function loadCustomer(){


const {data,error}=await supabase

.from("customers")

.select("*")

.eq("id",customerId)

.single();



if(error){

console.error(error);

alert(
"خطا در دریافت اطلاعات مشتری:\n"+
error.message
);

return;

}



setCustomer(data);



setForm({

name:data.name || "",

owner_name:data.owner_name || "",

phone:data.phone || "",

address:data.address || "",

province:data.province || "",

responsible:data.responsible || "",

visitor:data.visitor || "",

entry_fee:data.entry_fee || 0,

notes:data.notes || ""

});


}



async function loadCategories(){


const {data,error}=await supabase

.from("products")

.select("category");



if(error){

console.log(error);

return;

}



const list =
Array.from(
new Set(
(data || [])
.map(x=>x.category)
.filter(Boolean)
)
);



setCategories(list);


}



async function loadDiscounts(){


const {data,error}=await supabase

.from("customer_group_discounts")

.select("*")

.eq("customer_id",customerId);



if(error){

console.error(error);

alert(
"خطا در دریافت تخفیف‌های مشتری:\n"+
error.message
);

return;

}



setDiscounts(data || []);


}



async function loadMedia(){


const {data,error}=await supabase

.from("customer_media")

.select("*")

.eq("customer_id",customerId)

.order("created_at",{ascending:false});



if(error){

console.error(error);

return;

}



setMedia(data || []);


}



function money(value:number){


return new Intl.NumberFormat("fa-IR")

.format(value || 0)

+" ریال";


}
async function saveCustomer(){


const {error}=await supabase

.from("customers")

.update({

name:form.name,

owner_name:form.owner_name,

phone:form.phone,

address:form.address,

province:form.province,

responsible:form.responsible,

visitor:form.visitor,

entry_fee:Number(form.entry_fee),

notes:form.notes

})

.eq("id",customerId);



if(error){

alert(
"خطا در ذخیره اطلاعات:\n"+
error.message
);

return;

}



alert("اطلاعات مشتری ذخیره شد");


setEdit(false);


loadCustomer();


}




async function addDiscount(){


if(!discountCategory){

alert("گروه کالا را انتخاب کنید");

return;

}



if(Number(discountPercent)<=0){

alert("درصد تخفیف را وارد کنید");

return;

}



const {error}=await supabase

.from("customer_group_discounts")

.insert({

customer_id:customerId,

category:discountCategory,

discount_percent:Number(discountPercent)

});



if(error){

alert(
"خطا در ثبت تخفیف:\n"+
error.message
);

return;

}



setDiscountCategory("");

setDiscountPercent(0);


loadDiscounts();


}




async function deleteDiscount(id:string){



if(!confirm("حذف این تخفیف انجام شود؟"))

return;



const {error}=await supabase

.from("customer_group_discounts")

.delete()

.eq("id",id);



if(error){

alert(error.message);

return;

}



loadDiscounts();


}





async function uploadMedia(
e:React.ChangeEvent<HTMLInputElement>,
type:string
){



const file =
e.target.files?.[0];



if(!file)
return;



const fileName =
`${customerId}-${Date.now()}-${file.name}`;



const {error:uploadError}=await supabase

.storage

.from("customer-media")

.upload(
fileName,
file
);



if(uploadError){

alert(
"خطا در آپلود فایل:\n"+
uploadError.message
);

return;

}



const {data:urlData}=

supabase

.storage

.from("customer-media")

.getPublicUrl(fileName);



const publicUrl =
urlData.publicUrl;



const {error}=await supabase

.from("customer_media")

.insert({

customer_id:customerId,

media_type:type,

image_url:publicUrl

});



if(error){

alert(error.message);

return;

}



loadMedia();


}




async function deleteMedia(id:string){


if(!confirm("حذف فایل انجام شود؟"))

return;



const {error}=await supabase

.from("customer_media")

.delete()

.eq("id",id);



if(error){

alert(error.message);

return;

}



loadMedia();


}




function downloadFile(url:string){


window.open(
url,
"_blank"
);


}






return (

<AppShell>

<PageHeader

title={
customer
?
`مشتری: ${customer.name}`
:
"جزئیات مشتری"
}

subtitle="مدیریت اطلاعات، قراردادها و تخفیف مشتری"

/>
<div style={{
marginBottom:20
}}>

<BackButton title="بازگشت به مشتریان"/>

</div>

<div className="panel">

<h3>
اطلاعات مشتری
</h3>



<div className="form-grid">


<div className="form-field">

<label>
نام فروشگاه
</label>

<input

className="input"

disabled={!edit}

value={form.name}

onChange={e=>

setForm({

...form,

name:e.target.value

})

}

/>

</div>



<div className="form-field">

<label>
مالک / مسئول
</label>

<input

className="input"

disabled={!edit}

value={form.owner_name}

onChange={e=>

setForm({

...form,

owner_name:e.target.value

})

}

/>

</div>



<div className="form-field">

<label>
تلفن
</label>

<input

className="input"

disabled={!edit}

value={form.phone}

onChange={e=>

setForm({

...form,

phone:e.target.value

})

}

/>

</div>



<div className="form-field">

<label>
استان
</label>

<input

className="input"

disabled={!edit}

value={form.province}

onChange={e=>

setForm({

...form,

province:e.target.value

})

}

/>

</div>

      <div className="form-field">

        <label>
          آدرس
        </label>

        <input

        className="input"

        disabled={!edit}

        value={form.address}

        onChange={e=>

        setForm({

        ...form,

        address:e.target.value

        })

        }

        />

      </div>



      <div className="form-field">

        <label>
          ویزیتور
        </label>

        <input

        className="input"

        disabled={!edit}

        value={form.visitor}

        onChange={e=>

        setForm({

        ...form,

        visitor:e.target.value

        })

        }

        />

      </div>




      <div className="form-field">

        <label>
          مسئول
        </label>

        <input

        className="input"

        disabled={!edit}

        value={form.responsible}

        onChange={e=>

        setForm({

        ...form,

        responsible:e.target.value

        })

        }

        />

      </div>



      <div className="form-field">

        <label>
          مبلغ ورودیه
        </label>

        <input

        className="input"

        disabled={!edit}

        type="number"

        value={form.entry_fee}

        onChange={e=>

        setForm({

        ...form,

        entry_fee:Number(e.target.value)

        })

        }

        />

        <small>
          {money(form.entry_fee)}
        </small>


      </div>


</div>



<div className="action-row">


{

edit ?


<button

className="btn btn-primary"

onClick={saveCustomer}

>

<Save size={16}/>

ذخیره تغییرات

</button>


:

<button

className="btn btn-secondary"

onClick={()=>setEdit(true)}

>

ویرایش اطلاعات

</button>


}


</div>



</div>





{/* ==========================
        تخفیف گروهی
========================== */}



<div className="panel">


<h3>
تخفیف گروه‌های کالا
</h3>



<div className="form-grid">


<div className="form-field">


<label>
گروه کالا
</label>


<select

className="input"

value={discountCategory}

onChange={e=>

setDiscountCategory(e.target.value)

}

>


<option value="">

انتخاب گروه

</option>



{

categories.map(c=>(

<option

key={c}

value={c}

>

{c}

</option>

))

}


</select>


</div>




<div className="form-field">


<label>
درصد تخفیف
</label>


<input

className="input"

type="number"

value={discountPercent}

onChange={e=>

setDiscountPercent(
Number(e.target.value)
)

}

/>


</div>


</div>



<button

className="btn btn-primary"

onClick={addDiscount}

>


<Plus size={16}/>

افزودن تخفیف


</button>




<div className="table-wrap">


<table>


<thead>

<tr>

<th>
گروه کالا
</th>

<th>
درصد تخفیف
</th>

<th>
عملیات
</th>


</tr>

</thead>



<tbody>


{

discounts.map(item=>(


<tr key={item.id}>


<td>

{item.category}

</td>



<td>

{item.discount_percent}٪

</td>



<td>


<button

className="btn btn-danger btn-small"

onClick={()=>deleteDiscount(item.id)}

>


<Trash2 size={15}/>

حذف


</button>


</td>


</tr>


))


}



</tbody>


</table>


</div>


</div>
{/* ==========================
        قراردادها و تصاویر
========================== */}


<div className="panel">


<h3>
قراردادها و تصاویر مشتری
</h3>



<div
className="action-row"
style={{
marginBottom:20
}}
>


<label className="btn btn-primary">


<Upload size={16}/>

آپلود قرارداد / تصویر


<input

type="file"

hidden

accept="image/*,.pdf"

onChange={(e)=>

uploadMedia(
e,
"contract"
)

}

/>


</label>



<label className="btn btn-secondary">


<Upload size={16}/>

تصویر فروشگاه


<input

type="file"

hidden

accept="image/*"

onChange={(e)=>

uploadMedia(
e,
"image"
)

}

/>


</label>



</div>




<div
style={{
display:"grid",
gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",
gap:20,
alignItems:"start"
}}
>

{
media.map(item=>(

<div

key={item.id}

className="panel"

style={{
padding:15,
width:"100%",
overflow:"hidden"
}}

>


{
item.media_type==="image"

?

<img

src={item.image_url}

style={{

width:"100%",

height:"auto",

maxHeight:500,

objectFit:"contain",

borderRadius:12,

display:"block"

}}

/>

:

<iframe

src={item.image_url}

style={{

width:"100%",

height:180,

border:"1px solid #ddd",

borderRadius:12

}}

/>


}




<div

style={{

marginTop:12,

fontWeight:700

}}

>

{

item.media_type==="contract"

?

"📄 قرارداد مشتری"

:

"🖼 تصویر فروشگاه"

}

</div>



<div

style={{

display:"flex",

gap:8,

marginTop:12

}}

>


<button

className="btn btn-secondary btn-small"

onClick={()=>window.open(item.image_url,"_blank")}

>

مشاهده

</button>



<button

className="btn btn-primary btn-small"

onClick={()=>downloadFile(item.image_url)}

>

دانلود

</button>



<button

className="btn btn-danger btn-small"

onClick={()=>deleteMedia(item.id)}

>

حذف

</button>


</div>



</div>


))


}


</div>


</div>




</AppShell>


);


}