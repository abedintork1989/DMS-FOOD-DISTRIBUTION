"use client";

import AppShell from "@/components/AppShell";
import TerritoryMapManager from "@/components/territories/TerritoryMapManager";


export default function TerritoriesPage() {

  return (

    <AppShell>

      <div

        style={{

          direction:"rtl",

          height:"calc(100vh - 80px)",

          width:"100%",

          padding:0,

          margin:0

        }}

      >


        <div

          className="dashboard-panel"

          style={{

            width:"100%",

            height:"100%",

            padding:0,

            margin:0,

            overflow:"hidden",

            position:"relative"

          }}

        >


          {/* عنوان */}

          <div

            style={{

              position:"absolute",

              top:15,

              right:25,

              zIndex:20,

              fontSize:22,

              fontWeight:800

            }}

          >

            مدیریت محدوده‌ها

          </div>




          {/* MAP AREA */}

          <div

            style={{

              position:"absolute",

              top:0,

              right:0,

              left:0,

              bottom:0,

              width:"100%",

              height:"100%"

            }}

          >


            <TerritoryMapManager />


          </div>



        </div>


      </div>


    </AppShell>

  );

}