"use client";


type Territory={
 province:string;
 region:string;
};


export default function VisitorTerritories({

territories

}:{

territories:Territory[];

}){


return (

<section
className="dashboard-panel"
style={{
padding:20
}}
>

<h3>
محدوده‌های کاری
</h3>


{
territories.length===0 ?

<p>
هنوز محدوده‌ای ثبت نشده است.
</p>

:

<div
style={{
display:"grid",
gap:10
}}
>

{
territories.map((item,index)=>(

<div

key={index}

style={{
padding:12,
border:"1px solid #e2e8f0",
borderRadius:12,
background:"#f8fafc"
}}

>

<b>
{item.province}
</b>

<br/>

<span>
{item.region}
</span>


</div>

))

}

</div>

}


</section>

);


}