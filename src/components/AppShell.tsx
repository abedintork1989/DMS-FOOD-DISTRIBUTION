// components/AppShell.tsx

"use client";


import Header from "@/components/Header";



export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {


  return (

    <div className="app-root dms-app-root">


      <Header />



      <main className="app-content dms-content">

        {children}

      </main>


    </div>

  );

}