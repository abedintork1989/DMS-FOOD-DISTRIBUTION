"use client";


import { useEffect, useState } from "react";

import type { Order, OrderStatus } from "@/lib/types";

import { getOrders } from "@/lib/storage";

import { money } from "@/lib/format";





function statusLabel(status: OrderStatus) {


  const map: Record<
    string,
    readonly [string, string]
  > = {


    pending: [
      "در انتظار تایید",
      "warning"
    ],


    approved: [
      "تایید شده",
      "success"
    ],


    delivered: [
      "تحویل شده",
      "info"
    ],


    cancelled: [
      "لغو شده",
      "danger"
    ],


    partially_delivered: [
      "تحویل جزئی",
      "warning"
    ]

  };



  return (
    map[status] ||
    [
      status,
      "info"
    ]
  );

}









export default function OrderTable() {


  const [orders, setOrders] =
    useState<Order[]>([]);




  useEffect(() => {


    setOrders(
      getOrders()
        .slice(0, 6)
    );


  }, []);








  return (


    <div className="panel">


      <div className="panel-title">


        <h2>
          آخرین سفارش‌ها
        </h2>


        <span className="page-subtitle">
          آخرین ۶ سفارش
        </span>


      </div>







      <div className="table-wrap">


        <table>


          <thead>


            <tr>

              <th>
                شماره
              </th>


              <th>
                مشتری
              </th>


              <th>
                ویزیتور
              </th>


              <th>
                مبلغ
              </th>


              <th>
                وضعیت
              </th>


            </tr>


          </thead>







          <tbody>


            {
              orders.map((order) => {


                const [
                  label,
                  cls
                ] = statusLabel(order.status);



                const item =
                  order as any;



                const amount =
                  Number(
                    item.invoice_total ??
                    item.final_cost ??
                    item.total ??
                    0
                  );



                return (


                  <tr key={order.id}>


                    <td>
  {
    (order as any).order_number ??
    order.id
  }
</td>


                    <td>
                      {
                        item.customer_name ??
                        "-"
                      }
                    </td>


                    <td>
                      {
                        item.visitor ??
                        "-"
                      }
                    </td>


                    <td>
                      {
                        money(amount)
                      }
                    </td>


                    <td>

                      <span
                        className={`badge ${cls}`}
                      >
                        {label}
                      </span>

                    </td>


                  </tr>


                );


              })
            }


          </tbody>


        </table>





        {
          !orders.length &&
          <div className="empty">
            هنوز سفارشی ثبت نشده است.
          </div>
        }



      </div>


    </div>


  );

}