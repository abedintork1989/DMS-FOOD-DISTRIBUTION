"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Search } from "lucide-react";

import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";


type Customer = {
  id:string;
  name:string;
  visitor?:string;
};



type Product = {

  id:string;

  name:string;

  category:string;

  image_url?:string | null;

  quantity_per_carton?:number;

  consumer_price:number;

};



type Discount = {

  category:string;

  discount_percent:number;

};



export default function NewOrderPage(){


const router = useRouter();



const [customers,setCustomers] =
useState<Customer[]>([]);



const [products,setProducts] =
useState<Product[]>([]);



const [discounts,setDiscounts] =
useState<Discount[]>([]);



const [customerId,setCustomerId] =
useState("");



const [visitor,setVisitor] =
useState("");



const [deliveryDate,setDeliveryDate] =
useState("");



const [selectedCategory,setSelectedCategory] =
useState("");



const [search,setSearch] =
useState("");



const [cartons,setCartons] =
useState<Record<string,number>>({});





useEffect(()=>{

loadData();

},[]);





async function loadData(){


const {data:customerData}=

await supabase

.from("customers")

.select("id,name,visitor")

.eq("active",true);



if(customerData)

setCustomers(customerData);





const {data:productData}=

await supabase

.from("products")

.select(`

id,

name,

category,

image_url,

quantity_per_carton,

consumer_price

`)

.eq("active",true);



if(productData)

setProducts(productData);





const {data:discountData}=

await supabase

.from("customer_group_discounts")

.select("*");



if(discountData)

setDiscounts(discountData);



}

// ===============================
// بخش ۲
// ===============================


const categories = useMemo(()=>{

return Array.from(

new Set(

products.map(
p=>p.category
)

)

);


},[products]);





const filteredProducts =

products.filter(p=>{


if(
p.category !== selectedCategory
)

return false;



if(

search &&

!p.name.includes(search)

)

return false;



return true;


});







function getDiscount(category:string){


const item =

discounts.find(

d=>d.category===category

);



return item?.discount_percent || 0;



}







function finalPrice(product:Product){


const discount =

getDiscount(product.category);



return Math.round(

product.consumer_price -

(

product.consumer_price *

discount /

100

)

);


}







const totalCartons =

Object.values(cartons)

.reduce(

(sum,item)=>

sum + item,

0

);







const totalPurchaseAmount = products.reduce(
  (sum, product) => {

    const carton =
      cartons[product.id] || 0;


    const quantityPerCarton =
      product.quantity_per_carton || 1;


    const totalUnits =
      carton * quantityPerCarton;


    const price =
      finalPrice(product);


    return sum + (totalUnits * price);

  },
  0
);







async function saveOrder(){



if(!customerId){


alert(
"لطفاً مشتری را انتخاب کنید"
);


return;


}




const selectedItems =

products


.filter(

p=>

(cartons[p.id] || 0) > 0

)


.map(

(p,index)=>{


const carton =

cartons[p.id] || 0;



const orderUnits =

carton *

(p.quantity_per_carton || 1);



const price =

finalPrice(p);





return {

product_id:p.id,

order_units:orderUnits,

consumer_price:p.consumer_price,

discount_percent:getDiscount(p.category),

final_purchase_price:price,

total:orderUnits * price

};



}

);






if(!selectedItems.length){


alert(
"حداقل یک کالا انتخاب کنید"
);


return;


}






const totalAmount =

selectedItems.reduce(

(sum,item)=>

sum + item.total,

0

);







const {data:order,error}=

await supabase

.from("orders")

.insert({

customer_id:

customerId,





status:"pending",


invoice_total:

totalAmount,


final_cost:

totalAmount,


delivery_date:

deliveryDate || null


})
.select()

.single();






if(error){


alert(error.message);


return;


}






const items = selectedItems.map(item => ({

  order_id: order.id,

  product_id: item.product_id,

  quantity: Number(item.order_units) || 0,

  consumer_price: Number(item.consumer_price) || 0,

  discount_percent: item.discount_percent,

  purchase_price: Number(item.final_purchase_price) || 0,

  total_purchase_price: Number(item.total) || 0,

  final_price: item.final_purchase_price

}));





const {error:itemError}=


await supabase

.from("order_items")

.insert(items);






if(itemError){


alert(itemError.message);


return;


}






alert(
"سفارش با موفقیت ثبت شد"
);



router.push("/orders");



}

return (

<AppShell>


<PageHeader

title="ثبت سفارش جدید"

subtitle="ثبت سفارش توسط ویزیتور"

action={

<button

className="btn btn-secondary"

onClick={()=>router.back()}

>

<ArrowRight size={17}/>

برگشت

</button>

}

/>



<div className="panel">


<div className="form-grid">


<div className="form-field">


<label>

مشتری

</label>


<select

className="select"

value={customerId}

onChange={(e)=>{


const id = e.target.value;


setCustomerId(id);



const customer =

customers.find(

c=>c.id===id

);



if(customer)

setVisitor(

customer.visitor || ""

);



}}

>


<option value="">

انتخاب مشتری

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

ویزیتور

</label>


<input

className="input"

value={visitor}

readOnly

/>

</div>





<div className="form-field">


<label>

تاریخ ارسال کالا

</label>



<DatePicker

calendar={persian}

locale={persian_fa}

value={deliveryDate}

onChange={(date)=>{


setDeliveryDate(

date?.format("YYYY/MM/DD") || ""

);


}}

className="input"

/>


</div>



</div>





{/* خلاصه سفارش */}



<div

style={{

display:"flex",

gap:15,

marginTop:20,

marginBottom:20

}}

>



<div

className="panel"

style={{

padding:"10px 18px",

width:220,

textAlign:"center"

}}

>


<div>

تعداد کل کارتن سفارش

</div>



<strong

style={{

fontSize:22

}}

>

{totalCartons}

</strong>



<span>

 کارتن

</span>


</div>





<div

className="panel"

style={{

padding:"10px 18px",

width:250,

textAlign:"center"

}}

>


<div>

جمع کل خرید

</div>



<strong

style={{

fontSize:22

}}

>

{

totalPurchaseAmount.toLocaleString()

}

</strong>



<span>

 ریال

</span>



</div>



</div>




<hr

style={{

margin:"25px 0"

}}

/>



{
!selectedCategory &&

<>


<h3>

انتخاب گروه کالا

</h3>



<div

style={{

display:"grid",

gridTemplateColumns:

"repeat(auto-fit,minmax(180px,1fr))",

gap:15

}}

>


{

categories.map(category=>(


<button

key={category}

className="panel"

style={{

cursor:"pointer",

padding:20

}}

onClick={()=>{


setSelectedCategory(category);

setSearch("");

}}

>


{category}



<br/>


<small>

{

products.filter(

p=>p.category===category

).length

}

کالا

</small>



</button>


))

}



</div>



</>

}
{

selectedCategory &&

<>


<div

style={{

display:"flex",

justifyContent:"space-between",

alignItems:"center",

marginBottom:20

}}

>


<button

className="btn btn-secondary"

onClick={()=>setSelectedCategory("")}

>

← برگشت به گروه‌ها

</button>



<h3>

{selectedCategory}

</h3>



</div>





<div

style={{

display:"flex",

gap:10,

marginBottom:15

}}

>


<Search size={18}/>


<input

className="input"

placeholder="جستجوی کالا..."

value={search}

onChange={e=>setSearch(e.target.value)}

/>



</div>






<div className="table-wrap">


<table>


<thead>


<tr>


<th>
تصویر
</th>


<th>
نام کالا
</th>


<th>
تعداد در کارتن
</th>


<th>
تعداد کارتن
</th>


<th>
تعداد جزء
</th>


<th>
قیمت خرید مشتری
</th>


<th>
جمع
</th>


</tr>


</thead>





<tbody>


{


filteredProducts.map(product=>{


const price =

finalPrice(product);



const cartonsCount =

cartons[product.id] || 0;



const unitsCount =

cartonsCount *

(product.quantity_per_carton || 1);



const total =

unitsCount * price;





return (


<tr

key={product.id}

>


<td>


{

product.image_url ?

<img

src={product.image_url}

style={{

width:60,

height:60,

objectFit:"contain",

borderRadius:8

}}

/>

:

"—"

}



</td>





<td>

{product.name}

</td>





<td>


{

product.quantity_per_carton || 1

}


</td>





<td>


<input


className="input"


type="number"


min="0"


value={

cartons[product.id] || ""

}


onChange={e=>{


setCartons({

...cartons,


[product.id]:

Number(e.target.value)


})


}}


/>


</td>





<td>


{unitsCount}


</td>






<td>


{price.toLocaleString()}


</td>





<td>


{total.toLocaleString()}


</td>




</tr>


)



})


}




</tbody>



</table>



</div>



</>

}



<div

style={{

marginTop:25,

textAlign:"left"

}}

>


<button

className="btn btn-primary"

onClick={saveOrder}

>


<Check size={17}/>


ثبت نهایی سفارش


</button>



</div>



</div>


</AppShell>


);


}