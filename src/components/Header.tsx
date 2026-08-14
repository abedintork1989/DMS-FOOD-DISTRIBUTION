"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PackageSearch,
  Settings,
  ShoppingCart,
  UserCircle,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";

const mainItems = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/customers", label: "مشتریان", icon: Users },
  { href: "/reports", label: "گزارش‌ها", icon: BarChart3 },
  { href: "/settings", label: "تنظیمات", icon: Settings },
];

const menuGroups = [
  {
    label: "زنجیره تأمین",
    icon: PackageSearch,
    items: [
      { href: "/products", label: "کالاها", icon: Boxes },
      { href: "/orders", label: "سفارشات", icon: ShoppingCart },
      { href: "/warehouse", label: "انبار", icon: Warehouse },
    ],
  },
  {
    label: "مالی",
    icon: Wallet,
    items: [
      { href: "/marketing", label: "مارکتینگ", icon: Megaphone },
      { href: "/finance", label: "حسابداری", icon: Wallet },
      { href: "/checks", label: "مدیریت چک ها", icon: CheckCircle2 },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  function logout() {
    localStorage.removeItem("dms_user");
    router.push("/");
  }

  return (
    <header className="premium-header dms-premium-header">
      <Link href="/dashboard" className="premium-brand" aria-label="صفحه اصلی سیستم پخش">
        <div className="premium-logo"><div className="logo-shape">DMS</div></div>
        <div className="brand-text">
          <div className="brand-title"> مدیریت هوشمند فروش</div>
          <div className="brand-subtitle">Smart Sales Management</div>
        </div>
      </Link>

      <nav className="premium-menu" aria-label="منوی اصلی">
        {mainItems.slice(0, 2).map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`premium-menu-item ${pathname === item.href ? "active" : ""}`}>
              <Icon size={18} /><span>{item.label}</span>
            </Link>
          );
        })}

        {menuGroups.map((group) => {
          const Icon = group.icon;
          const isActive = group.items.some((item) => pathname === item.href);
          const isOpen = openMenu === group.label;
          return (
            <div className={`menu-dropdown ${isOpen ? "open" : ""}`} key={group.label}>
              <button
                type="button"
                className={`premium-menu-item dropdown-trigger ${isActive ? "active" : ""}`}
                onClick={() => setOpenMenu(isOpen ? null : group.label)}
                aria-expanded={isOpen}
              >
                <Icon size={18} /><span>{group.label}</span><ChevronDown className="dropdown-chevron" size={16} />
              </button>
              <div className="dropdown-panel">
                {group.items.map((item) => {
                  const SubIcon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className={`dropdown-item ${pathname === item.href ? "active" : ""}`} onClick={() => setOpenMenu(null)}>
                      <SubIcon size={17} /><span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {mainItems.slice(2).map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`premium-menu-item ${pathname === item.href ? "active" : ""}`}>
              <Icon size={18} /><span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="user-area">
        <button type="button" className="header-icon" aria-label="اعلان‌ها"><Bell size={19} /><span className="notification-dot" /></button>
        <button type="button" className="header-icon help-icon" aria-label="راهنما"><CircleHelp size={19} /></button>
        <div className="profile-box"><UserCircle size={39} /><div><div className="profile-name">عابدین ترک</div><div className="profile-role">مدیر سیستم</div></div></div>
        <button type="button" className="profile-logout" onClick={logout} aria-label="خروج از حساب"><LogOut size={18} /></button>
      </div>
    </header>
  );
}
