"use client";

import { useEffect, useState } from "react";


type Props = {
  value: number | string | undefined;
  onChange: (value:number)=>void;
  className?: string;
  placeholder?: string;
};



export default function NumberInput({
  value,
  onChange,
  className,
  placeholder
}:Props){


const [inputValue,setInputValue] = useState("");



useEffect(()=>{

  if(value !== undefined && value !== null){

    setInputValue(
      value
      ? formatNumber(Number(value))
      : ""
    );

  }

},[value]);





function formatNumber(num:number){

return new Intl.NumberFormat("fa-IR").format(num);

}






function convertPersianToEnglish(str:string){


return str
.replace(/[۰-۹]/g,(char)=>{

return String(
"۰۱۲۳۴۵۶۷۸۹".indexOf(char)
);

})
.replace(/,/g,"")
.replace(/٬/g,"");


}







function handleChange(
e:React.ChangeEvent<HTMLInputElement>
){


const text=e.target.value;



const clean=convertPersianToEnglish(text);



if(clean===""){

setInputValue("");

onChange(0);

return;

}



if(/^\d+$/.test(clean)){


const number=Number(clean);



setInputValue(
formatNumber(number)
);



onChange(number);



}


}






return (

<input

type="text"

inputMode="numeric"

className={className}

value={inputValue}

onChange={handleChange}

placeholder={placeholder}

/>

);


}