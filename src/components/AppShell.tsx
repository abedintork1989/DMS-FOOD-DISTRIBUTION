// components/AppShell.tsx
"use client";

import Sidebar from "@/components/Sidebar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <div className="app-root">

      <Sidebar />

      <main className="app-content">
        {children}
      </main>


      <style jsx global>{`

        html,
        body {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
          margin: 0;
        }


        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }


        .app-root {

          width: 100%;
          min-height: 100vh;

          display: flex;
          flex-direction: column;

        }


        .app-content {

          width: 100%;
          max-width: 100%;

          padding: 20px;

          overflow-x: hidden;

        }


        /*
          مدیریت هوشمند تمام صفحات و جدول‌ها
          بدون نیاز به تغییر تک تک Page ها
        */


        .panel,
        .card,
        .content-card {

          width: 100% !important;
          max-width: 100% !important;

        }


        .table-wrap,
        .data-table-wrapper,
        .data-table-container,
        .table-container {

          width: 100% !important;
          max-width: 100% !important;

        }


        table {

          width: 100% !important;

          max-width: 100% !important;

          table-layout: fixed;

        }


        th,
        td {

          white-space: nowrap;

          overflow: hidden;

          text-overflow: ellipsis;

          min-width: 0;

          max-width: 220px;

        }


        /*
          وقتی تعداد ستون‌ها زیاد شد،
          فقط همان جدول اسکرول می‌گیرد
          نه کل صفحه
        */

        .table-scroll,
        .table-wrap {

          overflow-x: auto;

          scrollbar-width: thin;

        }


        /*
          فرم‌ها و گریدها هم با عرض صفحه هماهنگ شوند
        */

        .form-grid,
        .grid {

          width: 100% !important;

          max-width: 100% !important;

        }


        @media(max-width: 900px){

          .app-content {

            padding: 12px;

          }

        }


      `}</style>

    </div>
  );
}
