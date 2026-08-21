"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MapPinned,
  PackageSearch,
  Route,
  ShoppingCart,
  UserCircle,
  UserRound,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";

type ModuleKey = "commercial" | "sales";

const commercialSections = [
  {
    label: "داشبورد",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "مشتریان",
    href: "/customers",
    icon: Users,
  },
  {
    label: "زنجیره تأمین",
    icon: PackageSearch,
    children: [
      { href: "/products", label: "کالاها", icon: Boxes },
      { href: "/orders", label: "سفارشات", icon: ShoppingCart },
      { href: "/returns", label: "مرجوعی", icon: PackageSearch },
      { href: "/warehouse", label: "انبار", icon: Warehouse },
    ],
  },
  {
    label: "مالی",
    icon: Wallet,
    children: [
      { href: "/marketing", label: "بازاریابی", icon: Megaphone },
      { href: "/finance", label: "حسابداری", icon: Wallet },
      { href: "/checks", label: "مدیریت چک‌ها", icon: CheckCircle2 },
    ],
  },
  {
    label: "گزارش‌ها",
    href: "/reports",
    icon: BarChart3,
  },
];

const salesSections = [
  {
    label: "داشبورد فروش",
    href: "/sales",
    icon: LayoutDashboard,
    disabled: true,
  },
  {
    label: "مرکز کنترل ویزیتورها",
    href: "/sales/visitor-control",
    icon: UserRound,
  },
  {
    label: "مدیریت ویزیتورها",
    href: "/sales/visitors",
    icon: UserRound,
  },
  {
    label: "برنامه ویزیت",
    href: "/sales/visit-plans",
    icon: CalendarDays,
  },
  {
    label: "نقشه هوشمند فروش",
    href: "/sales/map",
    icon: MapPinned,
    disabled: false,
  },
  {
    label: "مسیرها و ویزیت‌ها",
    href: "/sales/routes",
    icon: Route,
    disabled: true,
  },
  {
    label: "عملکرد و شاخص‌ها",
    href: "/sales/performance",
    icon: BarChart3,
    disabled: true,
  },
];

function isActivePath(pathname: string, href?: string) {
  if (!href) return false;

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getModuleForPath(pathname: string): ModuleKey | null {
  const commercialHasPath = commercialSections.some((section) => {
    if (section.href && isActivePath(pathname, section.href)) return true;

    return Boolean(
      section.children?.some((child) => isActivePath(pathname, child.href))
    );
  });

  if (commercialHasPath) return "commercial";

  const salesHasPath = salesSections.some((section) => {
    return Boolean(section.href && isActivePath(pathname, section.href));
  });

  if (salesHasPath) return "sales";

  return null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const routeModule = getModuleForPath(pathname);
  const activeModule: ModuleKey = routeModule || "commercial";

  // The open submenu is fully controlled by the user from now on.
  // It only changes when the user clicks a main menu button.
  // Navigating through a submenu link must NOT close it.
  // We just use the route to pick a sensible default the first time.
  const [openModule, setOpenModule] = useState<ModuleKey | null>(
    () => getModuleForPath(pathname)
  );

  function logout() {
    localStorage.removeItem("dms_user");
    router.push("/");
  }

  function openModuleMenu(module: ModuleKey) {
    setOpenModule((current) => (current === module ? null : module));
  }

  function handleSubmenuNavigation() {
    // Intentionally does nothing: clicking a submenu item should navigate
    // to the new page but keep the currently open submenu open. It will
    // only close when the user clicks a main menu button again.
  }

  return (
    <aside
      className="premium-header dms-premium-header dms-sidebar-left"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "280px",
        height: "100vh",
        flexDirection: "column",
        backgroundColor: "#b9ddc6",
        backgroundImage: `
          radial-gradient(circle at 8% 50%, rgba(15,107,67,0.14) 0 80px, transparent 81px),
          radial-gradient(circle at 28% 115%, rgba(15,107,67,0.10) 0 165px, transparent 166px),
          radial-gradient(circle at 52% -35%, rgba(15,107,67,0.085) 0 185px, transparent 186px),
          radial-gradient(circle at 88% 48%, rgba(15,107,67,0.13) 0 105px, transparent 106px),
          linear-gradient(135deg, rgba(12,104,65,0.14) 0%, rgba(15,107,67,0.08) 48%, rgba(255,255,255,0.16) 100%),
          linear-gradient(90deg, rgba(15,107,67,0.035) 1px, transparent 1px),
          linear-gradient(rgba(15,107,67,0.035) 1px, transparent 1px)
        `,
        backgroundSize: "auto, auto, auto, auto, 100% 100%, 28px 28px, 28px 28px",
        backgroundPosition: "left center, center, center, right center, center, center, center",
        borderBottom: "1px solid rgba(15,107,67,0.16)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <Link
        href="/dashboard"
        className="premium-brand"
        aria-label="صفحه اصلی سیستم پخش"

      >
        <div className="premium-logo">
          <div className="logo-shape">SSM</div>
        </div>
      </Link>

      <nav
        className="premium-menu sidebar-navigation"
        aria-label="بخش‌های اصلی نرم‌افزار"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          flex: "1 1 0%",
          minWidth: 0,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            direction: "rtl",
            zIndex: 2000,
            padding: 0,
            background: "transparent",
            border: "none",
            borderRadius: 0,
            boxShadow: "none",
          }}
        >
          {/* دو منوی اصلی */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              alignItems: "stretch",
              gap: 10,
            }}
          >
            <button
              type="button"
              className={`premium-menu-item main-module-button ${
                activeModule === "commercial" && openModule === "commercial"
                  ? "active"
                  : ""
              }`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openModuleMenu("commercial");
              }}
              aria-expanded={openModule === "commercial"}
              style={{
                flex: 1,
                width: "100%",
                height: 48,
                borderRadius: 6,
                background:
                  openModule === "commercial"
                    ? "linear-gradient(135deg, #149b5c 0%, #0d714a 100%)"
                    : "#f2f4f3",
                color:
                  openModule === "commercial" ? "#ffffff" : "#4b5563",
                fontWeight: openModule === "commercial" ? 800 : 700,
                border: "1px solid #c7d0cb",
                boxShadow:
                  openModule === "commercial"
                    ? "0 4px 12px rgba(15,107,67,0.14)"
                    : "none",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span>عملیات تجاری</span>
              <ChevronDown
                size={15}
                style={{
                  transform:
                    openModule === "commercial"
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                  transition: "transform 140ms ease",
                }}
              />
            </button>

            <button
              type="button"
              className={`premium-menu-item main-module-button ${
                activeModule === "sales" && openModule === "sales"
                  ? "active"
                  : ""
              }`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openModuleMenu("sales");
              }}
              aria-expanded={openModule === "sales"}
              style={{
                flex: 1,
                width: "100%",
                height: 48,
                borderRight: "1px solid #dfe5e2",
                borderRadius: 6,
                background:
                  openModule === "sales"
                    ? "linear-gradient(135deg, #149b5c 0%, #0d714a 100%)"
                    : "#f2f4f3",
                color: openModule === "sales" ? "#ffffff" : "#4b5563",
                fontWeight: openModule === "sales" ? 800 : 700,
                border: "1px solid rgba(255,255,255,0.55)",
                boxShadow:
                  openModule === "sales"
                    ? "0 6px 18px rgba(15,107,67,0.18), inset 0 1px 0 rgba(255,255,255,0.22)"
                    : "inset 0 1px 0 rgba(255,255,255,0.48)",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span>مدیریت فروش هوشمند</span>
              <ChevronDown
                size={15}
                style={{
                  transform:
                    openModule === "sales"
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                  transition: "transform 140ms ease",
                }}
              />
            </button>
          </div>

          {/* یک نوار زیرمنوی مشترک، هم‌عرض هر دو منوی اصلی */}
          {openModule && (
            <div
              style={{
                width: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                direction: "rtl",
                flexWrap: "nowrap",
                padding: 10,
                marginTop: 4,
                background: "linear-gradient(135deg, #149b5c 0%, #0d714a 100%)",
                border: "3px solid #0d714a",
                borderTop: "3px solid #0d714a",
                borderRadius: 8,
                boxShadow:
                  "0 6px 16px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.18)",
                overflowX: "auto",
              }}
            >
              {openModule === "commercial" &&
                commercialSections.map((section) => {
                  const Icon = section.icon;

                  if (section.children) {
                    return section.children.map((child) => {
                      const ChildIcon = child.icon;
                      const active = isActivePath(pathname, child.href);

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={handleSubmenuNavigation}
                          style={{
                            flex: "1 1 0",
                            minWidth: 0,
                            minHeight: 38,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                            padding: "6px 9px",
                            borderLeft: "1px solid #cfd6d2",
                            background: active ? "linear-gradient(135deg, #149b5c 0%, #0d714a 100%)" : "#f2f4f3",
                            color: active ? "#ffffff" : "#374151",
                            borderTop: "1px solid rgba(255,255,255,0.28)",
                            textDecoration: "none",
                            fontSize: 10.5,
                            fontWeight: active ? 800 : 600,
                            textAlign: "center",
                            whiteSpace: "nowrap",
                            fontFamily: "inherit",
                            borderRadius: 5,
                          }}
                        >
                          <ChildIcon size={13} />
                          <span>{child.label}</span>
                        </Link>
                      );
                    });
                  }

                  const active = isActivePath(pathname, section.href);

                  return (
                    <Link
                      key={section.label}
                      href={section.href!}
                      onClick={handleSubmenuNavigation}
                      style={{
                        flex: "1 1 0",
                        minWidth: 0,
                        minHeight: 38,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        padding: "6px 9px",
                        borderLeft: "1px solid #cfd6d2",
                        background: active ? "linear-gradient(135deg, #149b5c 0%, #0d714a 100%)" : "#f2f4f3",
                        color: active ? "#ffffff" : "#374151",
                        textDecoration: "none",
                        fontSize: 10.5,
                        fontWeight: active ? 800 : 600,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        fontFamily: "inherit",
                        borderRadius: 5,
                      }}
                    >
                      <Icon size={13} />
                      <span>{section.label}</span>
                    </Link>
                  );
                })}

              {openModule === "sales" &&
                salesSections.map((section) => {
                  const Icon = section.icon;
                  const active = isActivePath(pathname, section.href);

                  if (section.disabled) {
                    return (
                      <div
                        key={section.label}
                        style={{
                          flex: "1 1 0",
                          minWidth: 0,
                          minHeight: 38,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 5,
                          padding: "6px 9px",
                          borderLeft: "1px solid #cfd6d2",
                          background: "#f2f4f3",
                          color: "#9ca3af",
                          borderTop: "1px solid rgba(255,255,255,0.28)",
                          fontSize: 10.5,
                          fontWeight: 600,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          fontFamily: "inherit",
                          borderRadius: 5,
                        }}
                      >
                        <Icon size={13} />
                        <span>{section.label}</span>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={section.label}
                      href={section.href!}
                      onClick={handleSubmenuNavigation}
                      style={{
                        flex: "1 1 0",
                        minWidth: 0,
                        minHeight: 38,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        padding: "5px 8px",
                        borderLeft: "1px solid #cfd6d2",
                        background: active ? "linear-gradient(135deg, #149b5c 0%, #0d714a 100%)" : "#f2f4f3",
                        color: active ? "#ffffff" : "#374151",
                        textDecoration: "none",
                        fontSize: 10.5,
                        fontWeight: active ? 800 : 600,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        fontFamily: "inherit",
                        borderRadius: 5,
                      }}
                    >
                      <Icon size={13} />
                      <span>{section.label}</span>
                    </Link>
                  );
                })}
            </div>
          )}
        </div>
      </nav>

      <div
        className="user-area"
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          type="button"
          className="header-icon"
          aria-label="اعلان‌ها"
          style={{
            background: "rgba(255,255,255,0.20)",
            border: "1px solid rgba(255,255,255,0.58)",
            boxShadow: "0 8px 20px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.45)",
            backdropFilter: "blur(18px) saturate(145%)",
            WebkitBackdropFilter: "blur(18px) saturate(145%)",
          }}
        >
          <Bell size={19} />
          <span className="notification-dot" />
        </button>

        <button
          type="button"
          className="header-icon help-icon"
          aria-label="راهنما"
          style={{
            background: "rgba(255,255,255,0.20)",
            border: "1px solid rgba(255,255,255,0.58)",
            boxShadow: "0 8px 20px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.45)",
            backdropFilter: "blur(18px) saturate(145%)",
            WebkitBackdropFilter: "blur(18px) saturate(145%)",
          }}
        >
          <CircleHelp size={19} />
        </button>

        <div
          className="profile-box"
          style={{
            background: "rgba(255,255,255,0.20)",
            border: "1px solid rgba(255,255,255,0.58)",
            boxShadow: "0 8px 20px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.45)",
            backdropFilter: "blur(18px) saturate(145%)",
            WebkitBackdropFilter: "blur(18px) saturate(145%)",
          }}
        >
          <UserCircle size={39} />
          <div>
            <div className="profile-name">عابدین ترک</div>
            <div className="profile-role">مدیر سیستم</div>
          </div>
        </div>

        <button
          type="button"
          className="profile-logout"
          onClick={logout}
          style={{
            background: "rgba(255,255,255,0.20)",
            border: "1px solid rgba(255,255,255,0.58)",
            boxShadow: "0 8px 20px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.45)",
            backdropFilter: "blur(18px) saturate(145%)",
            WebkitBackdropFilter: "blur(18px) saturate(145%)",
          }}
          aria-label="خروج از حساب"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
