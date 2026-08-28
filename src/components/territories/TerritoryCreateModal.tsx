"use client";


import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";



type TerritoryInfo = {

province:string;

county:string;

activity:string;

countyId:string;

geometry:any;

};




type Item={

id:string;

name:string;

type:string;

parent_id:string|null;

geometry:any;

};




type Props={

open:boolean;

onClose:()=>void;

onStart:(data:TerritoryInfo)=>void;

};






export default function TerritoryCreateModal({

open,

onClose,

onStart

}:Props){



const [provinces,setProvinces]=
useState<Item[]>([]);


const [counties,setCounties]=
useState<Item[]>([]);



const [province,setProvince]=
useState<Item|null>(null);



const [county,setCounty]=
useState<Item|null>(null);



const [activity,setActivity]=
useState("");






useEffect(()=>{

if(open){

loadProvinces();

}

},[open]);






async function loadProvinces(){


const {data,error}=await supabase

.from("territories")

.select(
"id,name,type,parent_id,geometry"
)

.eq(
"type",
"province"
)

.eq(
"active",
true
)

.order("name");



if(error){

console.log(error);

return;

}


setProvinces(data||[]);


}








async function loadCounties(

provinceId:string

){



setCounties([]);

setCounty(null);




const {data,error}=await supabase

.from("territories")

.select(
"id,name,type,parent_id,geometry"
)

.eq(
"type",
"county"
)

.eq(
"parent_id",
provinceId
)

.eq(
"active",
true
)

.order("name");




if(error){

console.log(error);

return;

}



setCounties(data||[]);



}








function submit(){



if(
!province ||
!county ||
!activity
){

alert(
"اطلاعات را کامل انتخاب کنید"
);

return;

}




onStart({

province:

province.name,


county:

county.name,


activity,


countyId:

county.id,


geometry:

county.geometry


});



}







if(!open)

return null;







return (

<div

style={{

position:"fixed",

inset:0,

background:"rgba(0,0,0,.45)",

display:"flex",

alignItems:"center",

justifyContent:"center",

zIndex:10000,

direction:"rtl"

}}

>


<div

style={{

width:420,

background:"#fff",

padding:30,

borderRadius:20

}}

>


<h2>

ایجاد محدوده جدید

</h2>





<label>

استان

</label>


<select

style={selectStyle}

value={province?.id||""}

onChange={e=>{


const item=

provinces.find(

x=>x.id===e.target.value

);


setProvince(item||null);


if(item)

loadCounties(item.id);



}}

>


<option value="">

انتخاب استان

</option>


{

provinces.map(x=>(

<option

key={x.id}

value={x.id}

>

{x.name}

</option>

))

}


</select>









<label>

شهرستان

</label>


<select

style={selectStyle}

disabled={!province}

value={county?.id||""}

onChange={e=>{


const item=

counties.find(

x=>x.id===e.target.value

);


setCounty(item||null);



}}

>


<option value="">

انتخاب شهرستان

</option>


{

counties.map(x=>(

<option

key={x.id}

value={x.id}

>

{x.name}

</option>

))

}


</select>








<label>

نوع فعالیت

</label>


<select

style={selectStyle}

value={activity}

onChange={e=>

setActivity(e.target.value)

}

>


<option value="">

انتخاب فعالیت

</option>


<option>

زنجیره‌ای

</option>


<option>

مویرگی

</option>


</select>







<button

onClick={submit}

style={{

width:"100%",

padding:15,

background:"#16a34a",

color:"#fff",

border:0,

borderRadius:12,

fontWeight:900

}}

>

شروع ترسیم محدوده

</button>







<button

onClick={onClose}

style={{

width:"100%",

marginTop:10,

padding:12

}}

>

انصراف

</button>





</div>

</div>

);

}



const selectStyle={

width:"100%",

padding:12,

marginBottom:18,

borderRadius:10

};