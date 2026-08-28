import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";



const supabase = createClient(

  process.env.NEXT_PUBLIC_SUPABASE_URL!,

  process.env.SUPABASE_SERVICE_ROLE_KEY!

);





function normalizeName(value:string){

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



const filePath = path.join(

process.cwd(),

"public/data/iran-counties.geojson"

);



const geojson = JSON.parse(

fs.readFileSync(

filePath,

"utf8"

)

);





// گرفتن تمام شهرستان‌های دیتابیس

const {data: counties,error} = await supabase

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

"Database counties:",

counties.length

);







let updated=0;

let notFound=0;






for(const feature of geojson.features){



const rawName =

feature.properties?.name ||

feature.properties?.NAME ||

feature.properties?.Name;





if(!rawName)

continue;





const geoName =

normalizeName(rawName);






const match = counties.find(item=>{


const dbName =

normalizeName(item.name);



return (

dbName === geoName

);



});






if(!match){


console.log(

"NOT FOUND:",

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

"UPDATE ERROR:",

match.name,

updateError.message

);


continue;


}





console.log(

"✓",

match.name

);



updated++;






}





console.log("----------------");

console.log(

"UPDATED:",

updated

);


console.log(

"NOT FOUND:",

notFound

);



}




main();