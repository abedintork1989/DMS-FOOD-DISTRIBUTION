"use client";

import { useEffect, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import iranProvinces from "./data/iran-provinces.json";


export default function IranProvinceLayer() {

  const map = useMap();

  const [data,setData] = useState<any>(null);


  useEffect(()=>{

    setData(iranProvinces);

    setTimeout(()=>{

      map.invalidateSize();

    },300);

  },[map]);


  if(!data) return null;


  return (

    <GeoJSON

      data={data}

      style={()=>({

        color:"#16a34a",

        weight:1,

        fillColor:"#22c55e",

        fillOpacity:0.05

      })}


      onEachFeature={(feature:any,layer:any)=>{


        const name =
          feature?.properties?.name ||
          feature?.properties?.NAME ||
          "استان";


        layer.bindTooltip(
          name,
          {
            direction:"center"
          }
        );


        layer.on({

          mouseover(){

            layer.setStyle({

              fillOpacity:0.25,

              weight:2

            });

          },


          mouseout(){

            layer.setStyle({

              fillOpacity:0.05,

              weight:1

            });

          }

        });


      }}

    />

  );

}