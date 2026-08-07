"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "../../lib/supabase";


type Product = {
  id: string;
  name: string;
  category: string;
  barcode?: string;
  unit?: string;
  quantity_per_carton?: number;
  consumer_price?: number;
  inventory?: number;
};


export default function ProductsPage() {

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(false);


  const [form, setForm] = useState({
    name: "",
    category: "",
    barcode: "",
    unit: "",
    quantity_per_carton: 1,
    consumer_price: 0,
    inventory: 0
  });


  useEffect(() => {
    loadProducts();
  }, []);



  async function loadProducts(){

    setLoading(true);


    const {data,error}=await supabase
      .from("products")
      .select("*")
      .order("name");


    if(error){

      console.log(error);
      alert(error.message);

    }else{

      setProducts(data || []);

    }


    setLoading(false);

  }




  async function saveProduct(){


    if(!form.name){

      alert("نام کالا را وارد کنید");
      return;

    }


    const {error}=await supabase
      .from("products")
      .insert({

        name:form.name,
        category:form.category,
        barcode:form.barcode,
        unit:form.unit,
        quantity_per_carton:form.quantity_per_carton,
        consumer_price:form.consumer_price,
        inventory:form.inventory

      });



    if(error){

      alert(error.message);
      return;

    }


    alert("کالا ثبت شد");


    setModal(false);


    setForm({
      name:"",
      category:"",
      barcode:"",
      unit:"",
      quantity_per_carton:1,
      consumer_price:0,
      inventory:0
    });


    loadProducts();

  }





async function deleteProduct(id:string){


 const ok=confirm("حذف شود؟");


 if(!ok)return;



 const {error}=await supabase
 .from("products")
 .delete()
 .eq("id",id);



 if(error){

  alert(error.message);

 }else{

  loadProducts();

 }


}



return (

<AppShell>


<PageHeader

title="کالاها"

subtitle="مدیریت کالاهای شرکت پخش"

action={

<button

className="btn btn-primary"

onClick={()=>setModal(true)}

>

<Plus size={16}/>

کالای جدید

</button>

}

/>



<div className="panel table-wrap">


{
loading ?

<div>
در حال دریافت اطلاعات...
</div>


:


<table>


<thead>

<tr>

<th>نام کالا</th>

<th>گروه</th>

<th>بارکد</th>

<th>قیمت مصرف کننده</th>

<th>موجودی</th>

<th>عملیات</th>

</tr>

</thead>



<tbody>


{
products.map(p=>(


<tr key={p.id}>


<td>{p.name}</td>

<td>{p.category}</td>

<td>{p.barcode}</td>

<td>{p.consumer_price}</td>

<td>{p.inventory}</td>


<td>


<button

className="btn btn-danger btn-small"

onClick={()=>deleteProduct(p.id)}

>

<Trash2 size={14}/>

</button>


</td>


</tr>


))
}



</tbody>



</table>


}


</div>





{
modal &&


<div className="modal-backdrop">


<div className="modal">


<h2>

کالای جدید

</h2>



<input

className="input"

placeholder="نام کالا"

value={form.name}

onChange={e=>setForm({...form,name:e.target.value})}

/>


<br/>


<input

className="input"

placeholder="گروه کالا"

value={form.category}

onChange={e=>setForm({...form,category:e.target.value})}

/>



<br/>


<input

className="input"

placeholder="بارکد"

value={form.barcode}

onChange={e=>setForm({...form,barcode:e.target.value})}

/>


<br/>


<input

className="input"

type="number"

placeholder="قیمت مصرف کننده"

value={form.consumer_price}

onChange={e=>setForm({...form,consumer_price:Number(e.target.value)})}

/>



<br/>


<input

className="input"

type="number"

placeholder="موجودی"

value={form.inventory}

onChange={e=>setForm({...form,inventory:Number(e.target.value)})}

/>



<br/>


<button

className="btn btn-primary"

onClick={saveProduct}

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


}


</AppShell>

);


}