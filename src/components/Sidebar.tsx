"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  Megaphone
} from "lucide-react";


const items = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },

  { href: "/customers", label: "مشتریان", icon: Users },

  { href: "/products", label: "کالاها", icon: Boxes },

  { href: "/orders", label: "سفارشات", icon: ShoppingCart },

  { href: "/marketing", label: "مارکتینگ مشتریان", icon: Megaphone },

  { href: "/accounting", label: "مالی", icon: Wallet },

  { href: "/reports", label: "گزارش‌ها", icon: BarChart3 },

  { href: "/settings", label: "تنظیمات", icon: Settings }
];



export default function Sidebar({
  open = false,
  onClose
}: {
  open?: boolean;
  onClose?: () => void;
}) {


  const pathname = usePathname();
  const router = useRouter();



  function logout() {

    localStorage.removeItem("dms_user");

    router.push("/");

  }



  return (

    <aside className={`sidebar ${open ? "open" : ""}`}>


      <div className="sidebar-header">

        <h2>DMS پخش</h2>

        <p>مدیریت شرکت پخش</p>

      </div>



      <nav className="nav">


        {items.map((item) => {


          const Icon = item.icon;

          const active = pathname === item.href;



          return (

            <Link

              key={item.href}

              href={item.href}

              className={`nav-item ${active ? "active" : ""}`}

              onClick={onClose}

            >

              <Icon size={18} />

              <span>{item.label}</span>


            </Link>

          );


        })}


      </nav>



      <div className="sidebar-footer">


        <button

          className="logout-btn"

          onClick={logout}

        >

          <LogOut

            size={16}

            style={{
              verticalAlign: "middle",
              marginLeft: 7
            }}

          />

          خروج از حساب

        </button>


      </div>



    </aside>

  );


}