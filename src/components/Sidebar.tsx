import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  Megaphone,
} from "lucide-react";

const items = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/customers", label: "مشتریان", icon: Users },
  { href: "/products", label: "کالاها", icon: Boxes },
  { href: "/orders", label: "سفارشات", icon: ShoppingCart },
  { href: "/warehouse", label: "انبار", icon: Boxes },
  { href: "/marketing", label: "مارکتینگ مشتریان", icon: Megaphone },
  { href: "/finance", label: "مالی", icon: Wallet },
  { href: "/reports", label: "گزارش‌ها", icon: BarChart3 },
  { href: "/settings", label: "تنظیمات", icon: Settings },
];

export default function Sidebar({
  open = false,
  onClose,
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
    <aside className={`sidebar-modern ${open ? "open" : ""}`}>

      <div className="brand-modern">
        <div className="brand-title">
          DMS پخش
        </div>

        <div className="brand-subtitle">
          مدیریت شرکت پخش
        </div>
      </div>


      <nav className="menu-modern">

        {items.map((item) => {

          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`menu-item-modern ${
                active ? "active" : ""
              }`}
            >

              <Icon size={19}/>

              <span>
                {item.label}
              </span>

            </Link>
          );

        })}

      </nav>


      <button
        className="logout-modern"
        onClick={logout}
      >

        <LogOut size={17}/>

        خروج

      </button>


      <style jsx>{`

        .sidebar-modern {

          width:100%;

          background:#ffffff;

          border-bottom:1px solid #e2e8f0;

          padding:14px 24px;

          display:flex;

          align-items:center;

          gap:25px;

          direction:rtl;

        }


        .brand-modern {

          min-width:180px;

          padding-left:20px;

          border-left:1px solid #e2e8f0;

        }


        .brand-title {

          font-size:22px;

          font-weight:900;

          color:#0f172a;

        }


        .brand-subtitle {

          font-size:12px;

          color:#64748b;

          margin-top:3px;

        }


        .menu-modern {

          display:flex;

          align-items:center;

          gap:8px;

          flex:1;

          overflow-x:auto;

        }


        .menu-item-modern {

          display:flex;

          align-items:center;

          gap:7px;

          padding:10px 14px;

          border-radius:12px;

          color:#475569;

          text-decoration:none;

          white-space:nowrap;

          font-size:14px;

          font-weight:600;

          transition:.2s;

        }


        .menu-item-modern:hover {

          background:#f1f5f9;

          color:#0f172a;

        }


        .menu-item-modern.active {

          background:#0f172a;

          color:white;

        }


        .logout-modern {

          border:none;

          background:#fee2e2;

          color:#b91c1c;

          padding:10px 15px;

          border-radius:12px;

          display:flex;

          align-items:center;

          gap:7px;

          cursor:pointer;

          font-weight:700;

        }


        @media(max-width:900px){

          .sidebar-modern {

            flex-direction:column;

            align-items:stretch;

          }


          .brand-modern {

            border-left:none;

          }


          .menu-modern {

            flex-wrap:wrap;

          }

        }

      `}</style>

    </aside>
  );
}
