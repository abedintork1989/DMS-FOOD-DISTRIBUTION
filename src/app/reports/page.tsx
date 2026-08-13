"use client";


import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { getCustomers, getOrders } from "@/lib/storage";
import { money } from "@/lib/format";


type ReportRow = {
  name: string;
  orders: number;
  sales: number;
};


export default function ReportsPage() {

  const [rows, setRows] = useState<ReportRow[]>([]);


  useEffect(() => {

    const orders = getOrders();
    const customers = getCustomers();


    const report = customers.map((customer) => {


      const customerOrders = orders.filter(
        (order) =>
          order.customer_id === customer.id
      );


      const sales = customerOrders
        .filter(
          (order) =>
            order.status !== "cancelled"
        )
        .reduce(
          (sum, order) => {

            const item = order as any;


            return (
              sum +
              Number(
                item.invoice_total ??
                item.final_cost ??
                item.total ??
                0
              )
            );

          },
          0
        );


      return {

        name: customer.name,

        orders:
          customerOrders.length,

        sales

      };


    });


    setRows(report);


  }, []);



  return (

    <AppShell>

      <PageHeader
        title="گزارش‌ها"
        subtitle="گزارش فروش بر اساس مشتری"
      />


      <div className="panel table-wrap">

        <table>

          <thead>

            <tr>

              <th>
                مشتری
              </th>

              <th>
                تعداد سفارش
              </th>

              <th>
                فروش
              </th>

            </tr>

          </thead>


          <tbody>

            {
              rows.map((row)=>(

                <tr key={row.name}>

                  <td>
                    {row.name}
                  </td>


                  <td>
                    {row.orders.toLocaleString("fa-IR")}
                  </td>


                  <td>
                    {money(row.sales)}
                  </td>


                </tr>

              ))
            }


          </tbody>


        </table>


      </div>


    </AppShell>

  );

}