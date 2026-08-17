"use client";
import BackButton from "@/components/BackButton";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  MapPin,
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

// نقشه فقط سمت کلاینت لود می‌شود چون Leaflet به window نیاز دارد
// و در رندر سمت سرور Next.js باعث کرش می‌شود.
const LocationPickerMap = dynamic(
  () => import("@/components/Map/MapPicker"),
  {
    ssr: false,
    loading: () => (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "#64748b"
      }}>
        در حال بارگذاری نقشه...
      </div>
    )
  }
);




type Customer = {


  id:string;


  name:string;


  owner_name:string | null;


  phone:string | null;


  address:string | null;


  province:string | null;


    city:string | null;
  customer_type:string | null;
responsible:string | null;


  visitor:string | null;
  sales_visitor_id:string | null;


  entry_fee:number | null;
  
  settlement_days:number | null;

  notes:string | null;


};




type CustomerLocation = {
  customer_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  source: string | null;
  geocoded_at: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerGroup = {
  id: string;
  name: string;
  primary_customer_id: string;
  created_at?: string | null;
};

type BranchCustomer = {
  id: string;
  name: string;
  province: string | null;
  address: string | null;
  phone: string | null;
  visitor: string | null;
  sales_visitor_id: string | null;
  responsible: string | null;
  customer_group_id: string | null;
};

type VisitorOption = {
  id: string;
  full_name: string;
  phone: string | null;
  active: boolean;
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




function LeafletLocationPicker({
  open,
  initialLocation,
  saving,
  onClose,
  onSave,
}:{
  open:boolean;
  initialLocation:{latitude:number;longitude:number}|null;
  saving:boolean;
  onClose:()=>void;
  onSave:(latitude:number,longitude:number)=>void;
}){

  const [selected,setSelected]=useState(initialLocation);

  useEffect(()=>{
    if(open){
      setSelected(initialLocation);
    }
  },[open,initialLocation]);


  if(!open) return null;

  return (
    <div style={{
      position:"fixed",
      inset:0,
      zIndex:99999,
      background:"rgba(15,23,42,.58)",
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      padding:18
    }}>
      <div style={{
        width:"min(1100px,100%)",
        height:"min(760px,92vh)",
        background:"#fff",
        borderRadius:18,
        overflow:"hidden",
        display:"flex",
        flexDirection:"column"
      }}>

        <div style={{
          padding:16,
          borderBottom:"1px solid #e2e8f0",
          display:"flex",
          justifyContent:"space-between"
        }}>
          <div>
            <strong>ثبت موقعیت جغرافیایی مشتری</strong>
            <div style={{fontSize:12,color:"#64748b"}}>
              روی نقشه کلیک کنید یا نشانگر را جابه‌جا کنید.
            </div>
          </div>

          <button className="btn btn-secondary btn-small" onClick={onClose}>
            بستن
          </button>
        </div>


        <div style={{flex:1}}>
          <LocationPickerMap
            selected={selected}
            onChange={setSelected}
          />
        </div>


        <div style={{
          padding:14,
          borderTop:"1px solid #e2e8f0",
          display:"flex",
          justifyContent:"space-between"
        }}>
          <span>
            {selected
            ? `${selected.latitude.toFixed(6)} , ${selected.longitude.toFixed(6)}`
            :"یک نقطه انتخاب کنید"}
          </span>

          <button
            className="btn btn-primary"
            disabled={!selected || saving}
            onClick={()=>selected && onSave(selected.latitude,selected.longitude)}
          >
            {saving ? "در حال ذخیره..." : "ثبت موقعیت"}
          </button>
        </div>

      </div>
    </div>
  );
}


export default function CustomerDetailPage(){



const params = useParams();
const router = useRouter();
const searchParams = useSearchParams();



const customerId =
 typeof params.id === "string"
 ? params.id
 : "";


const isNewCustomer = customerId === "new";
const initialGroupId = searchParams.get("groupId") || "";
const isBranchCreate = isNewCustomer && Boolean(initialGroupId);




const [customer,setCustomer]=
useState<Customer | null>(null);




const [discounts,setDiscounts]=
useState<Discount[]>([]);




const [categories,setCategories]=
useState<string[]>([]);




const [media,setMedia]=
useState<Media[]>([]);

const [customerLocation,setCustomerLocation]=
useState<CustomerLocation | null>(null);

const [pendingLocation,setPendingLocation]=
useState<{latitude:number;longitude:number}|null>(null);

const [showLocationPicker,setShowLocationPicker]=
useState(false);

const [locationSaving,setLocationSaving]=
useState(false);

const [locationAddressLoading,setLocationAddressLoading]=
useState(false);




const [loading,setLoading]=
useState(true);




const [edit,setEdit]=
useState(false);




const [discountCategory,setDiscountCategory]=
useState("");




const [discountPercent,setDiscountPercent]=
useState(0);

const [customerGroup,setCustomerGroup]=
useState<CustomerGroup | null>(null);

const [branchCustomers,setBranchCustomers]=
useState<BranchCustomer[]>([]);

const [groupLoading,setGroupLoading]=
useState(false);

const [visitors,setVisitors]=
useState<VisitorOption[]>([]);

const [visitorsLoading,setVisitorsLoading]=
useState(false);




useEffect(() => {
  if(!customerId || isNewCustomer) return;
  loadDiscounts();
}, [customerId, customerGroup?.id, isNewCustomer]);

const [form,setForm]=useState({


name:"",


owner_name:"",


phone:"",


address:"",


province:"",


city:"",
  customer_type: initialGroupId ? "زنجیره‌ای" : "مویرگی",
    responsible:"",


visitor:"",
visitor_id:"",
entry_fee:0,


settlement_days:0,


notes:"",
customer_group_id: initialGroupId || null


});




useEffect(()=>{



if(!customerId)
return;



if(isNewCustomer){


 setEdit(true);
 setLoading(false);
 loadVisitors();


 setForm({
  name:"",
  owner_name:"",
  phone:"",
  address:"",
  province:"",
  city:"",
   customer_type:"مویرگی",
   responsible:"",
  visitor:"",
  visitor_id:"",
  entry_fee:0,
  settlement_days:0,
  notes:"",
  customer_group_id: initialGroupId || null
 });


 return;



}



loadCustomer();
loadVisitors();


loadCategories();


loadMedia();
loadCustomerLocation();


loadCustomerGroup();



},[customerId, initialGroupId]);




async function loadVisitors(){
  setVisitorsLoading(true);

  try{
    const {data,error}=await supabase
      .from("sales_visitors")
      .select("id,full_name,phone,active")
      .eq("active",true)
      .order("full_name",{ascending:true});

    if(error){
      console.error("LOAD VISITORS ERROR:",error);
      setVisitors([]);
      return;
    }

    setVisitors(
      (data || [])
        .map((visitor:any)=>({
          id:String(visitor.id),
          full_name:String(visitor.full_name || ""),
          phone:visitor.phone ? String(visitor.phone) : null,
          active:visitor.active !== false
        }))
        .filter((visitor:VisitorOption)=>visitor.full_name)
    );
  }finally{
    setVisitorsLoading(false);
  }
}

async function loadCustomerLocation(){
  if(!customerId || isNewCustomer){
    setCustomerLocation(null);
    return;
  }

  const {data,error}=await supabase
    .from("customer_locations")
    .select("*")
    .eq("customer_id",customerId)
    .maybeSingle();

  if(error){
    console.error("LOAD CUSTOMER LOCATION ERROR:",error);
    setCustomerLocation(null);
    return;
  }

  if(data){
    setCustomerLocation({
      customer_id:String(data.customer_id),
      latitude:Number(data.latitude),
      longitude:Number(data.longitude),
      accuracy_meters:
        data.accuracy_meters == null ? null : Number(data.accuracy_meters),
      source:data.source || null,
      geocoded_at:data.geocoded_at || null,
      created_at:String(data.created_at || ""),
      updated_at:String(data.updated_at || ""),
    });
  }else{
    setCustomerLocation(null);
  }
}

async function reverseGeocodeLocation(latitude:number,longitude:number){
  const response = await fetch(
    `/api/geocode/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`,
    { cache: "no-store" }
  );

  const result = await response.json().catch(() => null);

  if(!response.ok){
    throw new Error(result?.error || "دریافت آدرس از روی موقعیت جغرافیایی ناموفق بود.");
  }

  return {
    address: String(result?.address || "").trim(),
    province: result?.province ? String(result.province).trim() : "",
    city: result?.city ? String(result.city).trim() : "",
  };
}

async function saveCustomerLocation(latitude:number,longitude:number){
  setLocationSaving(true);
  setLocationAddressLoading(true);

  try{
    const geocode = await reverseGeocodeLocation(latitude,longitude);

    if(!geocode.address){
      throw new Error("برای این نقطه آدرس قابل شناسایی پیدا نشد. یک نقطه دقیق‌تر روی نقشه انتخاب کنید.");
    }

    if(isNewCustomer){
      setPendingLocation({
        latitude,
        longitude,
      });

      setForm(current => ({
        ...current,
        address:geocode.address,
        province:geocode.province || "",
        city:geocode.city || "",
      }));

      setShowLocationPicker(false);
      alert("موقعیت انتخاب شد و آدرس، استان و شهر از روی نقشه دریافت شد. با ذخیره مشتری، موقعیت نیز ثبت می‌شود.");
    }else{
      const now = new Date().toISOString();

      const {data,error}=await supabase
        .from("customer_locations")
        .upsert({
          customer_id:customerId,
          latitude,
          longitude,
          accuracy_meters:null,
          source:"manual",
          geocoded_at:now,
          updated_at:now,
        },{onConflict:"customer_id"})
        .select("*")
        .single();

      if(error) throw error;

      const { error: customerAddressError } = await supabase
        .from("customers")
        .update({
          address: geocode.address,
          province: geocode.province || null,
          city: geocode.city || null,
        })
        .eq("id",customerId);

      if(customerAddressError) throw customerAddressError;

      setCustomerLocation({
        customer_id:String(data.customer_id),
        latitude:Number(data.latitude),
        longitude:Number(data.longitude),
        accuracy_meters:data.accuracy_meters == null ? null : Number(data.accuracy_meters),
        source:data.source || null,
        geocoded_at:data.geocoded_at || null,
        created_at:String(data.created_at || ""),
        updated_at:String(data.updated_at || ""),
      });

      setPendingLocation(null);

      setForm(current => ({
        ...current,
        address:geocode.address,
        province:geocode.province || "",
        city:geocode.city || "",
      }));

      setShowLocationPicker(false);
      alert("موقعیت ثبت شد و آدرس مشتری به‌صورت خودکار از روی نقشه دریافت شد.");
    }
  }catch(error:any){
    console.error("SAVE CUSTOMER LOCATION ERROR:",error);
    alert(`خطا در ثبت موقعیت جغرافیایی یا دریافت آدرس:\n${error?.message || "نامشخص"}`);
  }finally{
    setLocationSaving(false);
    setLocationAddressLoading(false);
  }
}

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




const legacyVisitorId =
  data.sales_visitor_id ||
  visitors.find(
    (visitor) =>
      visitor.full_name.trim() ===
      String(data.visitor || "").trim()
  )?.id ||
  "";

setForm({


name:data.name || "",


owner_name:data.owner_name || "",


phone:data.phone || "",


address:data.address || "",


province:data.province || "",


city:data.city || "",
    customer_type: data.customer_group_id ? "زنجیره‌ای" : (data.customer_type || "مویرگی"),
    responsible:data.responsible || "",


visitor:data.visitor || "",
visitor_id:data.sales_visitor_id || "",


entry_fee:data.entry_fee || 0,


settlement_days:data.settlement_days ?? 0,


notes:data.notes || "",
customer_group_id:data.customer_group_id || null


});



}




async function loadCustomerGroup(){
  if(isNewCustomer || !customerId){
    setCustomerGroup(null);
    setBranchCustomers([]);
    return;
  }

  setGroupLoading(true);

  try{
    const {data:customerRow,error:customerError}=await supabase
      .from("customers")
      .select("id,name,customer_group_id")
      .eq("id",customerId)
      .single();

    if(customerError){
      console.error(customerError);
      setCustomerGroup(null);
      setBranchCustomers([]);
      return;
    }

    let groupId = customerRow?.customer_group_id || null;

    if(!groupId){
      const {data:ownedGroup}=await supabase
        .from("customer_groups")
        .select("id,name,primary_customer_id,created_at")
        .eq("primary_customer_id",customerId)
        .maybeSingle();

      if(ownedGroup){
        groupId=ownedGroup.id;
      }
    }

    if(!groupId){
      setCustomerGroup(null);
      setBranchCustomers([]);
      return;
    }

    const {data:groupData,error:groupError}=await supabase
      .from("customer_groups")
      .select("id,name,primary_customer_id,created_at")
      .eq("id",groupId)
      .single();

    if(groupError){
      console.error(groupError);
      setCustomerGroup(null);
      setBranchCustomers([]);
      return;
    }

    const isGroupParent =
      groupData.primary_customer_id === customerId;

    if (isGroupParent) {
      const {data:branches,error:branchError}=await supabase
        .from("customers")
        .select("id,name,province,address,phone,visitor,sales_visitor_id,responsible,customer_group_id")
        .eq("customer_group_id",groupId)
        .neq("id",customerId)
        .order("name",{ascending:true});

      if(branchError){
        console.error(branchError);
        setBranchCustomers([]);
      }else{
        setBranchCustomers((branches || []) as BranchCustomer[]);
      }
    } else {
      // در پرونده یک شعبه، لیست شعب دیگر نمایش داده نمی‌شود.
      // برای دیدن کل شعب، از پرونده مشتری مادر استفاده می‌شود.
      setBranchCustomers([]);
    }

    setCustomerGroup(groupData as CustomerGroup);
  }finally{
    setGroupLoading(false);
  }
}

async function createCustomerGroup(){
  if(isNewCustomer || !customerId){
    alert("ابتدا مشتری مادر را ذخیره کنید.");
    return;
  }

  if(customerGroup){
    alert("این مشتری از قبل عضو یک مجموعه است.");
    return;
  }

  if((form.customer_type || "مویرگی") !== "زنجیره‌ای"){
    alert("فقط مشتری از نوع «زنجیره‌ای» می‌تواند مجموعه و شعبه زیرمجموعه داشته باشد.");
    return;
  }

  const groupName=form.name.trim();

  if(!groupName){
    alert("ابتدا نام فروشگاه / مجموعه را وارد کنید.");
    return;
  }

  if(!confirm(`مجموعه «${groupName}» ساخته شود و این مشتری به عنوان مشتری مادر آن ثبت شود؟`)){
    return;
  }

  const {data,error}=await supabase
    .from("customer_groups")
    .insert({
      name:groupName,
      primary_customer_id:customerId
    })
    .select()
    .single();

  if(error){
    console.error(error);
    alert("خطا در ساخت مجموعه:\n"+error.message);
    return;
  }

  const {error:updateError}=await supabase
    .from("customers")
    .update({customer_group_id:data.id})
    .eq("id",customerId);

  if(updateError){
    await supabase
      .from("customer_groups")
      .delete()
      .eq("id",data.id);

    console.error(updateError);
    alert("خطا در اتصال مشتری به مجموعه:\n"+updateError.message);
    return;
  }

  alert("مجموعه با موفقیت ساخته شد.");
  await loadCustomer();
  await loadCustomerGroup();
}

function addBranch(){
  if((form.customer_type || "مویرگی") !== "زنجیره‌ای"){
    alert("فقط مشتری از نوع «زنجیره‌ای» می‌تواند شعبه زیرمجموعه داشته باشد.");
    return;
  }

  if(!customerGroup){
    alert("ابتدا این مشتری را به عنوان مجموعه مادر ثبت کنید.");
    return;
  }

  router.push(`/customers/new?groupId=${encodeURIComponent(customerGroup.id)}`);
}

function openBranch(branchId:string){
  router.push(`/customers/${branchId}`);
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

const discountCustomerId =
  customerGroup?.primary_customer_id || customerId;

const {data,error}=await supabase
.from("customer_group_discounts")
.select("*")
.eq("customer_id",discountCustomerId)
.order("category",{ascending:true});

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



if(isNewCustomer){

if(initialGroupId){
  const {data:parent,error:parentError}=await supabase
    .from("customer_groups")
    .select("id,primary_customer_id")
    .eq("id",initialGroupId)
    .maybeSingle();

  if(parentError){
    alert("امکان بررسی مجموعه مادر وجود ندارد:\n"+parentError.message);
    return;
  }

  if(parent?.primary_customer_id){
    const {data:parentCustomer,error:parentCustomerError}=await supabase
      .from("customers")
      .select("customer_type")
      .eq("id",parent.primary_customer_id)
      .maybeSingle();

    if(parentCustomerError){
      alert("امکان بررسی نوع مشتری مادر وجود ندارد:\n"+parentCustomerError.message);
      return;
    }

    if(parentCustomer?.customer_type !== "زنجیره‌ای"){
      alert("فقط مشتری زنجیره‌ای می‌تواند شعبه زیرمجموعه داشته باشد.");
      return;
    }
  }
}

const forcedCustomerType = initialGroupId
  ? "زنجیره‌ای"
  : (form.customer_type || "مویرگی");

const {data,error}=await supabase
.from("customers")
.insert({
 name:form.name,
 owner_name:form.owner_name || null,
 phone:form.phone || null,
 address:form.address || null,
 province:null,
   city:null,
   customer_type:forcedCustomerType,
  responsible:form.responsible || null,
 visitor:form.visitor || null,
 sales_visitor_id:form.visitor_id || null,
 entry_fee:Number(form.entry_fee) || 0,
 settlement_days:Number(form.settlement_days) || 0,
 notes:form.notes || null,
 customer_group_id: form.customer_group_id || initialGroupId || null,
 active:true
})
.select()
.single();



if(error){
 alert("خطا در ثبت مشتری:\\n"+error.message);
 return;
}



if(data?.id){
  if(pendingLocation){
    const now = new Date().toISOString();

    const { error: locationError } = await supabase
      .from("customer_locations")
      .upsert({
        customer_id:data.id,
        latitude:pendingLocation.latitude,
        longitude:pendingLocation.longitude,
        accuracy_meters:null,
        source:"manual",
        geocoded_at:now,
        updated_at:now,
      },{onConflict:"customer_id"});

    if(locationError){
      console.error("SAVE NEW CUSTOMER LOCATION ERROR:", locationError);
      alert(
        "مشتری ساخته شد، اما موقعیت جغرافیایی ذخیره نشد:\n" +
        locationError.message
      );
    }
  }

  router.push(`/customers/${data.id}`);
}

return;



}



const selectedCustomerType =
  customerGroup && customerGroup.primary_customer_id !== customerId
    ? "زنجیره‌ای"
    : (form.customer_type || "مویرگی");

  const {error}=await supabase
    .from("customers")
    .update({
      name:form.name,
      owner_name:form.owner_name,
      phone:form.phone,
      address:form.address,
      responsible:form.responsible,
      visitor:form.visitor,
      sales_visitor_id:form.visitor_id || null,
      entry_fee:Number(form.entry_fee),
      settlement_days:Number(form.settlement_days),
      notes:form.notes,
      customer_type:selectedCustomerType,
      customer_group_id: form.customer_group_id || null
    })
    .eq("id",customerId);

  if(error){
    alert(
      "خطا در ذخیره اطلاعات:\n"+
      error.message
    );
    return;
  }

  // اگر این مشتری «مادر مجموعه» باشد، نوع مشتری برای تمام شعبه‌های
  // همان مجموعه نیز دقیقاً یکسان می‌شود.
  if (
    customerGroup &&
    customerGroup.primary_customer_id === customerId
  ) {
    const { error: branchTypeError } = await supabase
      .from("customers")
      .update({
        customer_type: selectedCustomerType,
      })
      .eq("customer_group_id", customerGroup.id)
      .neq("id", customerId);

    if (branchTypeError) {
      console.error("UPDATE BRANCH CUSTOMER TYPES ERROR:", branchTypeError);
      alert(
        "اطلاعات مشتری مادر ذخیره شد، اما نوع مشتری شعبه‌ها به‌روزرسانی نشد:\n" +
        branchTypeError.message
      );
      await loadCustomer();
      await loadCustomerGroup();
      return;
    }
  }

  await loadCustomer();
  await loadCustomerGroup();

  alert(
    customerGroup &&
    customerGroup.primary_customer_id === customerId
      ? "اطلاعات مشتری مادر ذخیره شد و نوع مشتری تمام شعبه‌ها نیز به‌روزرسانی شد."
      : "اطلاعات مشتری ذخیره شد"
  );

  setEdit(false);



loadCustomer();



}





async function addDiscount(){

if(customerGroup && customerGroup.primary_customer_id !== customerId){
alert("تخفیف شعبه از مشتری مادر گرفته می‌شود و جداگانه قابل ثبت نیست.");
return;
}

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


  const file = e.target.files?.[0];
  if(!file)
    return;

  // جلوگیری از آپلود قبل از ساخته شدن مشتری
  if(isNewCustomer || !customerId){
    alert("ابتدا مشتری را ذخیره کنید، سپس قرارداد یا تصویر را آپلود کنید.");
    return;
  }

  // بررسی نوع فایل
  if(type === "contract"){


    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/jpg"
    ];


    if(!allowed.includes(file.type)){
      alert("فقط فایل PDF یا تصویر قابل آپلود است.");
      return;
    }


  }

  // محدودیت حجم 10 مگابایت
  const maxSize = 10 * 1024 * 1024;


  if(file.size > maxSize){
    alert("حجم فایل نباید بیشتر از 10 مگابایت باشد.");
    return;
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g,"_");


  const fileName =
    `${customerId}-${Date.now()}-${safeName}`;

  const {error:uploadError}=await supabase
    .storage
    .from("customer-media")
    .upload(
      fileName,
      file,
      {
        contentType:file.type,
        upsert:false
      }
    );



  if(uploadError){


    console.error(uploadError);


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



  const publicUrl = urlData.publicUrl;



  const {error}=await supabase


    .from("customer_media")


    .insert({


      customer_id:customerId,


      media_type:type === "image" ? "store_image" : "contract",


      image_url:publicUrl


    });




  if(error){


    // اگر ثبت دیتابیس شکست خورد، فایل Storage باقی نمی‌ماند
    await supabase
      .storage
      .from("customer-media")
      .remove([fileName]);



    alert(
      "خطا در ثبت اطلاعات فایل:\n"+
      error.message
    );


    return;


  }

  alert("فایل با موفقیت آپلود شد");


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


subtitle={
  isBranchCreate
    ? "ثبت اطلاعات اصلی شعبه"
    : customerGroup && customerGroup.primary_customer_id !== customerId
    ? "مدیریت شعبه و اطلاعات این مشتری"
    : "مدیریت اطلاعات، قراردادها، تخفیف و ساختار مجموعه مشتری"
}


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

{isBranchCreate && (
  <div
    style={{
      marginBottom:16,
      padding:12,
      borderRadius:8,
      background:"#eff6ff",
      border:"1px solid #bfdbfe",
      color:"#1e3a8a"
    }}
  >
    این مشتری به‌عنوان شعبه زیرمجموعه مجموعه مادر ثبت می‌شود.
    تخفیف‌های گروه کالا و فایل‌های شعبه از مشتری مادر استفاده می‌شوند.
  </div>
)}




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
          readOnly
          value={form.province}
          placeholder="پس از ثبت موقعیت روی نقشه تعیین می‌شود."
          style={{
            background:"#f8fafc",
            cursor:"not-allowed"
          }}
        />


</div>


      <div className="form-field">
        <label>
          شهر
        </label>

        <input
          className="input"
          readOnly
          value={form.city}
          placeholder="پس از ثبت موقعیت روی نقشه تعیین می‌شود."
          style={{
            background:"#f8fafc",
            cursor:"not-allowed"
          }}
        />
      </div>

      <div className="form-field">
        <label>
          نوع مشتری
        </label>

        <select
          className="input"
          disabled={!edit || isBranchCreate}
          value={form.customer_type}
          onChange={e =>
            setForm({
              ...form,
              customer_type:e.target.value
            })
          }
        >
          <option value="زنجیره‌ای">زنجیره‌ای</option>
          <option value="VIP">VIP</option>
          <option value="مویرگی">مویرگی</option>
        </select>

        {isBranchCreate && (
          <small style={{display:"block",marginTop:6,color:"#64748b"}}>
            نوع این شعبه به‌صورت خودکار «زنجیره‌ای» است چون زیرمجموعه مشتری مادر زنجیره‌ای ایجاد شده و قابل تغییر نیست.
          </small>
        )}
      </div>

      <div
        className="form-field full"
        style={{gridColumn:"1 / -1"}}
      >
        <label>
          آدرس
        </label>

        <input
          className="input"
          readOnly
          value={form.address}
          placeholder="پس از ثبت موقعیت روی نقشه، آدرس به‌صورت خودکار درج می‌شود."
          style={{
            background:"#f8fafc",
            cursor:"not-allowed",
            width:"100%",
          }}
        />

        <small style={{display:"block",marginTop:6,color:"#64748b"}}>
          آدرس فقط از روی موقعیت جغرافیایی مشتری تعیین می‌شود و قابل ورود دستی نیست.
        </small>
      </div>

      <div className="form-field full" style={{gridColumn:"1 / -1"}}>
        <label>موقعیت جغرافیایی</label>
         <small style={{display:"block",marginTop:4,color:"#64748b"}}>
           استان و شهر فقط از روی موقعیت انتخاب‌شده روی نقشه تعیین می‌شوند و دستی قابل ویرایش نیستند.
         </small>
        <div style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",
          gap:12,flexWrap:"wrap",padding:12,
          border:"1px solid #dbe3ea",borderRadius:12,background:"#f8fafc"
        }}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{
              width:38,height:38,borderRadius:10,background:"#e9f4ef",
              color:"#0f6b43",display:"grid",placeItems:"center"
            }}>
              <MapPin size={19}/>
            </div>
            <div>
              <strong style={{display:"block",fontSize:13}}>
                {customerLocation
                   ? "موقعیت مشتری ثبت شده است"
                   : pendingLocation
                   ? "موقعیت برای مشتری جدید انتخاب شده است"
                   : "موقعیت مشتری هنوز ثبت نشده"}
              </strong>
              <span style={{display:"block",marginTop:4,fontSize:11,color:"#64748b"}}>
                {customerLocation
                  ? `${customerLocation.latitude.toFixed(6)} , ${customerLocation.longitude.toFixed(6)}`
                  : "با نقشه موقعیت فروشگاه را مشخص کنید."}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={locationSaving}
            onClick={()=>{
              setShowLocationPicker(true);
            }}
          >
            <MapPin size={16}/>
            {locationSaving
              ? "در حال دریافت آدرس..."
              : customerLocation
              ? "ویرایش موقعیت روی نقشه"
              : "ثبت موقعیت روی نقشه"}
          </button>
        </div>

        {locationAddressLoading && !isNewCustomer && (
          <small style={{display:"block",marginTop:6,color:"#0f6b43"}}>
            در حال دریافت آدرس خودکار از روی مختصات انتخاب‌شده...
          </small>
        )}

        {isNewCustomer && (
          <small style={{display:"block",marginTop:6,color:"#64748b"}}>
            می‌توانید موقعیت را همین حالا روی نقشه انتخاب کنید؛ با ذخیره مشتری، موقعیت و اطلاعات مکانی نیز ثبت می‌شوند.
          </small>
        )}
      </div>


      <div className="form-field">
        <label>
          ویزیتور
        </label>

        <select
          className="input"
          disabled={!edit || visitorsLoading}
          value={form.visitor_id}
          onChange={e=>{
            const visitorId=e.target.value;
            const selectedVisitor=visitors.find(v=>v.id===visitorId);

            setForm({
              ...form,
              visitor_id:visitorId,
              visitor:selectedVisitor?.full_name || ""
            });
          }}
        >
          <option value="">
            {visitorsLoading
              ? "در حال دریافت ویزیتورها..."
              : "انتخاب ویزیتور"}
          </option>

          {visitors.map(visitor=>(
            <option key={visitor.id} value={visitor.id}>
              {visitor.full_name}
              {visitor.phone ? ` — ${visitor.phone}` : ""}
            </option>
          ))}
        </select>

        {!visitorsLoading && visitors.length===0 && (
          <small
            style={{
              display:"block",
              marginTop:6,
              color:"#b45309"
            }}
          >
            هنوز ویزیتور فعالی تعریف نشده است.
          </small>
        )}
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




      <div className="form-field">
        <label>
          مدت تسویه (روز)
        </label>
        <input
        className="input"
        disabled={!edit}
        type="number"
        value={form.settlement_days}
        onChange={e =>
          setForm({
            ...form,
            settlement_days: Number(e.target.value)
          })
        }
        placeholder="0"
        />
        <small>
          {form.settlement_days === 0
            ? "نقدی"
            : form.settlement_days === -1
            ? "بدون محدودیت"
            : `${new Intl.NumberFormat("fa-IR").format(form.settlement_days)} روز`}
        </small>
      </div>


      <div className="form-field full">
        <label>
          توضیحات
        </label>
        <textarea
        className="textarea"
        rows={3}
        disabled={!edit}
        value={form.notes}
        onChange={e =>
          setForm({
            ...form,
            notes: e.target.value
          })
        }
        placeholder="توضیحات مربوط به مشتری"
        />
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
        مجموعه و شعب
========================== */}

<div className="panel">
  <div
    style={{
      display:"flex",
      justifyContent:"space-between",
      alignItems:"center",
      gap:12,
      flexWrap:"wrap",
      marginBottom:16
    }}
  >
    <div>
      <h3 style={{margin:0}}>
        مجموعه و شعب مشتری
      </h3>
      <div style={{marginTop:6,color:"#64748b",fontSize:13}}>
        هر شعبه همچنان یک مشتری مستقل در سیستم است و فقط به مجموعه مادر متصل می‌شود.
      </div>
    </div>

    {!isNewCustomer && !customerGroup && form.customer_type === "زنجیره‌ای" && (
      <button
        className="btn btn-primary"
        onClick={createCustomerGroup}
      >
        <Plus size={16}/>
        ساخت مجموعه از این مشتری
      </button>
    )}

    {!isNewCustomer && customerGroup && form.customer_type === "زنجیره‌ای" && (
      <button
        className="btn btn-primary"
        onClick={addBranch}
      >
        <Plus size={16}/>
        افزودن شعبه
      </button>
    )}
  </div>

  {isNewCustomer ? (
    <div
      style={{
        padding:14,
        borderRadius:10,
        background:"#f8fafc",
        border:"1px solid #e2e8f0",
        color:"#475569"
      }}
    >
      {initialGroupId
        ? "این مشتری جدید به عنوان یک شعبه برای مجموعه انتخاب‌شده ثبت خواهد شد."
        : "برای ساخت شعبه، ابتدا مشتری مادر را ذخیره کنید و از داخل همان مشتری روی «افزودن شعبه» بزنید."}
    </div>
  ) : groupLoading ? (
    <div style={{padding:20,color:"#64748b"}}>
      در حال دریافت ساختار مجموعه...
    </div>
  ) : customerGroup ? (
    <>
      <div
        style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
          gap:12,
          marginBottom:18
        }}
      >
        <div style={{padding:14,borderRadius:10,background:"#eff6ff",border:"1px solid #bfdbfe"}}>
          <div style={{fontSize:12,color:"#64748b"}}>نام مجموعه</div>
          <strong>{customerGroup.name}</strong>
        </div>

        <div style={{padding:14,borderRadius:10,background:"#f0fdf4",border:"1px solid #bbf7d0"}}>
          <div style={{fontSize:12,color:"#64748b"}}>نقش مشتری فعلی</div>
          <strong>
            {customerGroup.primary_customer_id === customerId
              ? "مشتری مادر"
              : "شعبه"}
          </strong>
        </div>

        <div style={{padding:14,borderRadius:10,background:"#fff7ed",border:"1px solid #fed7aa"}}>
          <div style={{fontSize:12,color:"#64748b"}}>تعداد شعب</div>
          <strong>{branchCustomers.length.toLocaleString("fa-IR")}</strong>
        </div>
      </div>

      {customerGroup.primary_customer_id !== customerId ? (
        <div
          style={{
            padding:14,
            borderRadius:10,
            background:"#f8fafc",
            border:"1px solid #e2e8f0"
          }}
        >
          <div style={{marginBottom:10}}>
            <strong>مشتری مادر / مجموعه:</strong>{" "}
            {customerGroup.name}
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => openBranch(customerGroup.primary_customer_id)}
          >
            مشاهده پرونده مجموعه
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>نام شعبه</th>
                <th>آدرس</th>
                <th>استان</th>
                <th>تلفن</th>
                <th>ویزیتور</th>
                <th>مسئول</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {branchCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    هنوز شعبه‌ای برای این مجموعه ثبت نشده است.
                  </td>
                </tr>
              ) : (
                branchCustomers.map((branch) => (
                  <tr key={branch.id}>
                    <td style={{fontWeight:700}}>{branch.name}</td>
                    <td>{branch.address || "-"}</td>
                    <td>{branch.province || "-"}</td>
                    <td>{branch.phone || "-"}</td>
                    <td>{branch.visitor || "-"}</td>
                    <td>{branch.responsible || "-"}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => openBranch(branch.id)}
                      >
                        مشاهده شعبه
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  ) : (
    <div
      style={{
        padding:14,
        borderRadius:10,
        background:"#fffbeb",
        border:"1px solid #fde68a",
        color:"#854d0e"
      }}
    >
      این مشتری هنوز عضو هیچ مجموعه‌ای نیست. برای مجموعه‌ای که چند شعبه دارد،
      ابتدا روی «ساخت مجموعه از این مشتری» بزنید؛ سپس از همین قسمت شعبه‌ها را اضافه کنید.
    </div>
  )}
</div>

{!isBranchCreate && (
  <>
{/* ==========================
        تخفیف گروهی
========================== */}




<div className="panel">



<h3>
تخفیف گروه‌های کالا
</h3>

{customerGroup && customerGroup.primary_customer_id !== customerId && (
<div
style={{
marginTop:10,
marginBottom:14,
padding:12,
borderRadius:8,
background:"#eff6ff",
border:"1px solid #bfdbfe",
color:"#1e3a8a"
}}
>
این شعبه از درصدهای تخفیف مشتری مادر «{customerGroup.name}» استفاده می‌کند.
تخفیف شعبه جداگانه نیست و تغییر آن فقط از پرونده مشتری مادر انجام می‌شود.
</div>
)}




<div className="form-grid">



<div className="form-field">



<label>
گروه کالا
</label>



<select


className="input"


disabled={Boolean(customerGroup && customerGroup.primary_customer_id !== customerId)}


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


disabled={Boolean(customerGroup && customerGroup.primary_customer_id !== customerId)}


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


disabled={Boolean(customerGroup && customerGroup.primary_customer_id !== customerId)}


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


disabled={Boolean(customerGroup && customerGroup.primary_customer_id !== customerId)}


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
  </>
)}

{!isBranchCreate && (
  <>
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






  </>
)}

      <LeafletLocationPicker
        open={showLocationPicker}
        initialLocation={customerLocation ? {
          latitude:customerLocation.latitude,
          longitude:customerLocation.longitude
        } : null}
        saving={locationSaving}
        onClose={()=>setShowLocationPicker(false)}
        onSave={saveCustomerLocation}
      />

</AppShell>



);



}
