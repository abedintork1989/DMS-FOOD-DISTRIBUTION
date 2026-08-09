"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";


export default function BackButton({
  title = "بازگشت"
}:{
  title?:string;
}){


const router = useRouter();


return (

<button

className="btn btn-secondary"

onClick={()=>router.back()}

style={{
display:"flex",
alignItems:"center",
gap:8
}}

>

<ArrowRight size={16}/>

{title}


</button>


);


}