import fs from "fs";
import path from "path";

import { createClient } from "@supabase/supabase-js";




// خواندن دستی env.local

const envPath = path.join(
  process.cwd(),
  ".env.local"
);



if (!fs.existsSync(envPath)) {

  throw new Error(
    ".env.local پیدا نشد"
  );

}



const envContent =
fs.readFileSync(
  envPath,
  "utf8"
);



for (const line of envContent.split("\n")) {


  const cleanLine =
  line.trim();



  if(
    !cleanLine ||
    cleanLine.startsWith("#")
  )
  continue;



  const index =
  cleanLine.indexOf("=");



  if(index === -1)
  continue;



  const key =
  cleanLine.substring(
    0,
    index
  ).trim();



  const value =
  cleanLine.substring(
    index + 1
  ).trim();



  process.env[key] =
  value.replace(/^["']|["']$/g,"");

}








const supabaseUrl =
process.env.NEXT_PUBLIC_SUPABASE_URL;



const serviceKey =
process.env.SUPABASE_SERVICE_ROLE_KEY;





if(!supabaseUrl){

throw new Error(
"NEXT_PUBLIC_SUPABASE_URL پیدا نشد"
);

}



if(!serviceKey){

throw new Error(
"SUPABASE_SERVICE_ROLE_KEY پیدا نشد"
);

}






const supabase =
createClient(

supabaseUrl,

serviceKey

);









function normalizeName(
value:string
){


return value

.trim()

.replace(/ي/g,"ی")

.replace(/ك/g,"ک")

.replace(/ۀ/g,"ه")

.replace(/\u200c/g,"")

.replace(/\s+/g,"")

.replace(/^شهرستان/g,"")

.replace(/^شهر/g,"");

}









async function main(){



const geoPath =
path.join(

process.cwd(),

"public/data/iran-counties.geojson"

);





if(!fs.existsSync(geoPath)){


throw new Error(
"فایل iran-counties.geojson پیدا نشد"
);


}






const geojson =

JSON.parse(

fs.readFileSync(

geoPath,

"utf8"

)

);






console.log(
"تعداد GeoJSON:",
geojson.features.length
);








const {data: counties,error} =

await supabase

.from("territories")

.select(

"id,name"

)

.eq(

"type",

"county"

);






if(error){

throw error;

}





console.log(

"تعداد شهرستان دیتابیس:",

counties.length

);







let updated = 0;

let notFound = 0;







for(
const feature of geojson.features
){





const rawName =

feature.properties?.name ||

feature.properties?.NAME ||

feature.properties?.Name;







if(!rawName)
continue;







const geoName =

normalizeName(
rawName
);






const match =

counties.find(item=>{


const dbName =

normalizeName(
item.name
);



return dbName === geoName;


});







if(!match){


console.log(

"❌ پیدا نشد:",

rawName

);


notFound++;

continue;

}







const {error:updateError}=

await supabase

.from("territories")

.update({

geometry:

feature.geometry

})

.eq(

"id",

match.id

);







if(updateError){


console.log(

"خطای آپدیت:",

match.name,

updateError.message

);


continue;

}







console.log(

"✅",

match.name

);



updated++;






}







console.log(
"----------------------"
);


console.log(

"آپدیت شده:",

updated

);



console.log(

"پیدا نشده:",

notFound

);






}





main()
.catch(error=>{


console.error(
error
);


process.exit(1);


});