"use client";

import Sidebar from "@/components/Sidebar/Sidebar";


export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {


  return (

    <div className="app-root dms-app-root">


      <Sidebar />


      <main className="app-content dms-content">

        {children}

      </main>


    </div>

  );

}