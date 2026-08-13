"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileImage, FileText, Plus, Trash2, Upload } from "lucide-react";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import NumberInput from "@/components/NumberInput";

import { supabase } from "@/lib/supabase";
import { money } from "@/lib/format";

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

	description:string | null;
	contract_file_url:string | null;
	contract_file_path:string | null;
	contract_files?:Array<{
		name:string;
		url:string;
		path:string;
		type:string;
	}> | null;
customers?:Customer;

};




const emptyForm = {

customer_id:"",

start_date:null as any,

end_date:null as any,

shelf_rent:0,

tray_rent:0,

board_rent:0,

promoter_cost:0,

side_cost:0,

foc_amount:0
,
	description:"",
	contract_files:[] as File[]
};





export default function MarketingPage(){


const [customers,setCustomers]=useState<Customer[]>([]);

const [items,setItems]=useState<Marketing[]>([]);

const [modal,setModal]=useState(false);

const [form,setForm]=useState<any>(emptyForm);
const [uploadingContract,setUploadingContract]=useState(false);





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









function convertDate(value:any){


if(!value)

return null;



return value
.toDate()
.toISOString()
.split("T")[0];


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









function showDate(value:string){


if(!value)

return "-";


return new Intl.DateTimeFormat(
"fa-IR"
).format(new Date(value));


}









function isAllowedContractFile(file:File){
return [
"application/pdf",
"image/jpeg",
"image/png",
"image/webp",
].includes(file.type);
}

function formatFileSize(bytes:number){
if(bytes < 1024 * 1024){
return `${Math.max(1,Math.round(bytes / 1024))} KB`;
}
return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadContractFiles(marketingId:string,files:File[]){
const uploaded:{
name:string;
url:string;
path:string;
type:string;
}[] = [];

for(const file of files){
const safeName = file.name
.normalize("NFKD")
.replace(/[^a-zA-Z0-9._-]/g,"-")
.replace(/-+/g,"-");

const path = `customer-marketing/${form.customer_id}/${marketingId}/${Date.now()}-${Math.random()
.toString(36)
.slice(2,8)}-${safeName}`;

const {error:uploadError} = await supabase.storage
.from("marketing-contracts")
.upload(path,file,{
cacheControl:"3600",
upsert:false,
contentType:file.type,
});

if(uploadError) throw uploadError;

const {data} = supabase.storage
.from("marketing-contracts")
.getPublicUrl(path);

uploaded.push({
name:file.name,
url:data.publicUrl,
path,
type:file.type,
});
}

return uploaded;
}

async function removeContractFile(path:string | null | undefined){
if(!path) return;
const {error} = await supabase.storage
.from("marketing-contracts")
.remove([path]);
if(error) console.warn("CONTRACT FILE DELETE WARNING:",error);
}

async function save(){
if(!form.customer_id){
alert("فروشگاه را انتخاب کنید");
return;
}

const contractFiles:File[] = Array.isArray(form.contract_files)
? form.contract_files
: [];

for(const file of contractFiles){
if(!isAllowedContractFile(file)){
alert(`فایل «${file.name}» مجاز نیست. فقط PDF، JPG، PNG یا WEBP مجاز است.`);
return;
}

if(file.size > 10 * 1024 * 1024){
alert(
`حجم فایل «${file.name}» نباید بیشتر از 10 MB باشد. حجم فعلی: ${formatFileSize(file.size)}`
);
return;
}
}

setUploadingContract(contractFiles.length > 0);

try{
const {data:marketing,error} = await supabase
.from("customer_marketing")
.insert({
customer_id:form.customer_id,
start_date:convertDate(form.start_date),
end_date:convertDate(form.end_date),
shelf_rent:Number(form.shelf_rent),
tray_rent:Number(form.tray_rent),
board_rent:Number(form.board_rent),
promoter_cost:Number(form.promoter_cost),
side_cost:Number(form.side_cost),
foc_amount:Number(form.foc_amount),
description:form.description?.trim() || null,
contract_file_url:null,
contract_file_path:null,
contract_files:[],
})
.select("id")
.single();

if(error) throw error;
if(!marketing?.id){
throw new Error("شناسه مارکتینگ بعد از ثبت دریافت نشد.");
}

if(contractFiles.length > 0){
const uploadedFiles = await uploadContractFiles(
marketing.id,
contractFiles
);

const {error:updateError} = await supabase
.from("customer_marketing")
.update({
contract_file_url:uploadedFiles[0]?.url || null,
contract_file_path:uploadedFiles[0]?.path || null,
contract_files:uploadedFiles,
})
.eq("id",marketing.id);

if(updateError){
for(const uploaded of uploadedFiles){
await removeContractFile(uploaded.path);
}

await supabase
.from("customer_marketing")
.delete()
.eq("id",marketing.id);

throw updateError;
}
}

setModal(false);
setForm(emptyForm);
await loadMarketing();
alert("مارکتینگ با موفقیت ثبت شد.");
}catch(error:any){
console.error("MARKETING SAVE ERROR:",error);
alert(
`خطا در ثبت مارکتینگ: ${error?.message || "خطای نامشخص"}`
);
}finally{
setUploadingContract(false);
}
}

async function remove(id:string){
if(!confirm("این مارکتینگ و همه فایل‌های قرارداد آن حذف شود؟")){
return;
}

const item = items.find((marketing) => marketing.id === id);

const {error} = await supabase
.from("customer_marketing")
.delete()
.eq("id",id);

if(error){
alert(error.message);
return;
}

const paths = [
...(Array.isArray(item?.contract_files)
? item.contract_files
.map((file) => file.path)
.filter(Boolean)
: []),
item?.contract_file_path || null,
].filter(
(path,index,array):path is string =>
Boolean(path) && array.indexOf(path) === index
);

for(const path of paths){
await removeContractFile(path);
}

await loadMarketing();
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

<th>مبلغ کل</th>

<th>توضیحات</th>

<th>تصویر قرارداد</th>

<th>عملیات</th>

</tr>

</thead>



<tbody>


{

items.map(item=>(


<tr key={item.id}>


<td>

{item.customers?.name}

</td>


<td>

{item.customers?.province}

</td>


<td>

{item.customers?.visitor}

</td>


<td>

{showDate(item.start_date)}

</td>


<td>

{showDate(item.end_date)}

</td>


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

<td style={{ minWidth: 220, whiteSpace: "pre-wrap" }}>

{item.description || "-"}

</td>

<td style={{ minWidth: 220 }}>
{(() => {
const files = Array.isArray(item.contract_files) && item.contract_files.length
? item.contract_files
: item.contract_file_url
? [{
name:"قرارداد",
url:item.contract_file_url,
path:item.contract_file_path || "",
type:item.contract_file_url.toLowerCase().includes(".pdf")
? "application/pdf"
: "image/*",
}]
: [];

return files.length ? (
<div
style={{
display:"flex",
flexDirection:"column",
gap:6,
alignItems:"flex-start",
}}
>
{files.map((file,index) => (
<a
key={`${file.path || file.url}-${index}`}
href={file.url}
target="_blank"
rel="noreferrer"
className="btn btn-secondary btn-small"
style={{
display:"inline-flex",
alignItems:"center",
gap:6,
}}
>
{String(file.type || "").toLowerCase().includes("pdf")
? <FileText size={14}/>
: <FileImage size={14}/>}
{file.name || `فایل قرارداد ${index + 1}`}
<ExternalLink size={13}/>
</a>
))}
</div>
) : (
<span style={{ color: "#94a3b8" }}>—</span>
);
})()}
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

<label>

فروشگاه

</label>


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

<label>

از تاریخ

</label>


<DatePicker

calendar={persian}

locale={persian_fa}

value={form.start_date}

inputClass="input"

onChange={(date:any)=>

setForm({

...form,

start_date:date

})

}


/>


</div>







<div className="form-field">

<label>

تا تاریخ

</label>


<DatePicker

calendar={persian}

locale={persian_fa}

value={form.end_date}

inputClass="input"

onChange={(date:any)=>

setForm({

...form,

end_date:date

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


<label>

{label}

</label>



<NumberInput

className="input"

value={form[key]}

onChange={(value)=>

setForm({

...form,

[key]:value

})

}

/>


</div>



))


}



</div>

<div className="form-field" style={{ gridColumn: "1 / -1" }}>

<label>
توضیحات
</label>

<textarea
className="input"
value={form.description || ""}
rows={3}
placeholder="توضیحات مارکتینگ را وارد کنید"
onChange={e=>
setForm({
...form,
description:e.target.value
})
}
/>

</div>

<div className="form-field" style={{ gridColumn: "1 / -1" }}>

<label>
تصاویر / فایل‌های قرارداد
</label>

<div
style={{
display:"flex",
flexDirection:"column",
alignItems:"flex-start",
gap:10,
}}
>
<label
className="btn btn-secondary btn-small"
style={{ cursor:"pointer" }}
>
<Upload size={14}/>
انتخاب فایل‌ها
<input
type="file"
multiple
accept=".pdf,image/jpeg,image/png,image/webp"
style={{ display:"none" }}
onChange={(event) => {
const files = Array.from(event.target.files || []);

for(const file of files){
if(!isAllowedContractFile(file)){
alert(
`فایل «${file.name}» مجاز نیست. فقط PDF، JPG، PNG یا WEBP مجاز است.`
);
event.currentTarget.value = "";
return;
}

if(file.size > 10 * 1024 * 1024){
alert(
`حجم فایل «${file.name}» نباید بیشتر از 10 MB باشد. حجم فعلی: ${formatFileSize(file.size)}`
);
event.currentTarget.value = "";
return;
}
}

setForm({
...form,
contract_files:files,
});
}}
/>
</label>

{form.contract_files.length > 0 ? (
<div
style={{
display:"flex",
flexDirection:"column",
gap:6,
width:"100%",
}}
>
{form.contract_files.map((file:File,index:number) => (
<div
key={`${file.name}-${file.size}-${index}`}
style={{
display:"flex",
alignItems:"center",
justifyContent:"space-between",
gap:10,
padding:"8px 10px",
border:"1px solid #e2e8f0",
borderRadius:8,
background:"#f8fafc",
width:"100%",
}}
>
<div
style={{
display:"flex",
alignItems:"center",
gap:8,
minWidth:0,
}}
>
{file.type === "application/pdf"
? <FileText size={16}/>
: <FileImage size={16}/>}
<span
style={{
fontSize:12,
overflow:"hidden",
textOverflow:"ellipsis",
whiteSpace:"nowrap",
}}
>
{file.name} — {formatFileSize(file.size)}
</span>
</div>

<button
type="button"
className="btn btn-danger btn-small"
onClick={() =>
setForm({
...form,
contract_files:form.contract_files.filter(
(_file:File,fileIndex:number) => fileIndex !== index
),
})
}
>
<Trash2 size={14}/>
</button>
</div>
))}
</div>
) : (
<span style={{ fontSize:12,color:"#94a3b8" }}>
می‌توانید چند فایل PDF یا تصویر انتخاب کنید؛ حداکثر 10MB برای هر فایل.
</span>
)}

</div>

</div>

<h3>

جمع کل:

{money(total())}

</h3>






<div className="action-row">


<button

className="btn btn-primary"

onClick={save}
disabled={uploadingContract}
>

{uploadingContract ? "در حال آپلود..." : "ذخیره"}

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