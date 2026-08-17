"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Users,
  MapPinned,
  Filter,
  TrendingUp,
  Palette,
  ChevronDown,
} from "lucide-react";

export type HeaderTab = "filters" | "stats" | "legend" | null;

export type CustomerMapFilter =
  | "chain"
  | "vip"
  | "retail"
  | "active"
  | "inactive"
  | "first_purchase"
  | "regular"
  | "lost"
  | "at_risk";

export const CUSTOMER_FILTER_COLORS: Record<CustomerMapFilter, string> = {
  chain: "#d4af37",
  vip: "#d4af37",
  retail: "#dc2626",
  active: "#16a34a",
  inactive: "#64748b",
  first_purchase: "#06b6d4",
  regular: "#0ea5e9",
  lost: "#dc2626",
  at_risk: "#f97316",
};

type NavTab = {
  id: string;
  title: string;
  href?: string;
  children?: { id: string; title: string; href?: string; filter?: CustomerMapFilter }[];
};

const navTabs: NavTab[] = [
  {
    id: "customers",
    title: "مشتریان",
    children: [
      { id: "chain", title: "مشتریان زنجیره‌ای", filter: "chain" },
      { id: "vip", title: "مشتریان VIP", filter: "vip" },
      { id: "retail", title: "مشتریان مویرگی", filter: "retail" },
      { id: "active", title: "مشتریان فعال", filter: "active" },
      { id: "inactive", title: "مشتریان غیرفعال", filter: "inactive" },
      { id: "first_purchase", title: "مشتریان خرید اولی", filter: "first_purchase" },
      { id: "regular", title: "مشتریان دائمی", filter: "regular" },
      { id: "lost", title: "مشتریان از دست‌رفته", filter: "lost" },
      { id: "at_risk", title: "مشتریان در خطر ریزش", filter: "at_risk" },
    ],
  },
  { id: "visitors", title: "ویزیتورها", href: "/visitors" },
  {
    id: "areas",
    title: "محدوده شهرها",
    children: [
      {
        id: "coverage",
        title: "تراکم و پوشش",
        href: "/customers/map",
      },
      {
        id: "routes",
        title: "مسیرها و ویزیت",
        href: "/visitors/routes",
      },
    ],
  },
  {
    id: "search",
    title: "جستجو",
    href: "/search",
  },
];

export default function MapHeaderTabs({
  mode,
  onModeChange,
  activeTab,
  onTabChange,
  showLegendTab,
  selectedCustomerFilter,
  onCustomerFilterChange,
}: {
  mode: "markers" | "regions";
  onModeChange: (mode: "markers" | "regions") => void;
  activeTab: HeaderTab;
  onTabChange: (tab: HeaderTab) => void;
  showLegendTab: boolean;
  selectedCustomerFilter: CustomerMapFilter | null;
  onCustomerFilterChange: (filter: CustomerMapFilter | null) => void;
}) {
  const router = useRouter();

  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const activeNavId = "coverage";
  const activeParentId = "customers";


  function goTo(href?: string) {
    if (!href) return;
    router.push(href);
    setOpenMenu(null);
  }


  function toggleTab(tab: Exclude<HeaderTab, null>) {
    onTabChange(activeTab === tab ? null : tab);
  }


  return (
    <div
      dir="rtl"
      className="
      rounded-xl
      border
      bg-white
      p-3
      shadow-sm
      mb-5
      "
    >

      {/* =========================
          منوی اصلی افقی
      ========================== */}

      <div
        className="
        flex
        flex-wrap
        items-center
        justify-center
        gap-2
        "
      >

        {navTabs.map((tab) => {

          const isActiveParent =
            tab.id === activeParentId;


          return (

            <div
              key={tab.id}
              className="relative"
            >

              <button
                onClick={() =>
                  tab.children
                    ? setOpenMenu(
                        openMenu === tab.id
                          ? null
                          : tab.id
                      )
                    : goTo(tab.href)
                }
                className={`
                flex
                items-center
                gap-1
                rounded-xl
                px-5
                py-2
                text-sm
                font-bold
                whitespace-nowrap
                transition

                ${
                  isActiveParent
                    ? "bg-green-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }
                `}
              >

                {tab.title}

                {tab.children && (
                  <ChevronDown size={14}/>
                )}

              </button>


              {/* Dropdown */}

              {tab.children &&
                openMenu === tab.id && (

                <div
                  className="
                  absolute
                  right-1/2
                  translate-x-1/2
                  top-full
                  mt-3
                  z-50
                  flex
                  gap-2
                  rounded-xl
                  border
                  bg-white
                  p-3
                  shadow-lg
                  "
                >

                  {tab.children.map(
                    (child)=>(
                    <button
                      key={child.id}
                      onClick={() => {
                        if (child.filter) {
                          onCustomerFilterChange(
                            selectedCustomerFilter === child.filter ? null : child.filter
                          );
                          return;
                        }
                        goTo(child.href);
                      }}
                      style={child.filter && selectedCustomerFilter === child.filter
                        ? {
                            background: CUSTOMER_FILTER_COLORS[child.filter],
                            color: "#fff",
                          }
                        : undefined}
                      className="
                      whitespace-nowrap
                      rounded-lg
                      px-3
                      py-2
                      text-right
                      text-sm
                      font-semibold
                      text-slate-600
                      hover:bg-slate-50
                      flex items-center gap-2
                      "
                    >
                      {child.filter && (
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: CUSTOMER_FILTER_COLORS[child.filter],
                            display: "inline-block",
                            flexShrink: 0,
                            boxShadow: selectedCustomerFilter === child.filter
                              ? `0 0 0 3px ${CUSTOMER_FILTER_COLORS[child.filter]}22`
                              : "none",
                          }}
                        />
                      )}
                      {child.title}
                    </button>
                  ))}

                </div>

              )}

            </div>

          );

        })}


      </div>



      {/* =========================
          کنترل‌های نقشه
      ========================== */}


      <div
        className="
        mt-3
        flex
        flex-wrap
        items-center
        justify-between
        gap-3
        border-t
        pt-3
        "
      >


        <div className="flex flex-wrap gap-2">


          <button
            onClick={() =>
              toggleTab("filters")
            }
            className={`
            flex
            items-center
            gap-2
            rounded-lg
            px-3
            py-1.5
            text-sm
            font-bold

            ${
              activeTab === "filters"
              ?
              "bg-green-700 text-white"
              :
              "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }
            `}
          >

            <Filter size={15}/>
            فیلترها

          </button>



          <button
            onClick={() =>
              toggleTab("stats")
            }
            className={`
            flex
            items-center
            gap-2
            rounded-lg
            px-3
            py-1.5
            text-sm
            font-bold

            ${
              activeTab === "stats"
              ?
              "bg-green-700 text-white"
              :
              "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }
            `}
          >

            <TrendingUp size={15}/>
            آمار کلی

          </button>



          {showLegendTab && (

            <button
              onClick={() =>
                toggleTab("legend")
              }
              className={`
              flex
              items-center
              gap-2
              rounded-lg
              px-3
              py-1.5
              text-sm
              font-bold

              ${
                activeTab === "legend"
                ?
                "bg-green-700 text-white"
                :
                "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }
              `}
            >

              <Palette size={15}/>
              راهنمای رنگ

            </button>

          )}

        </div>



        <div className="flex flex-wrap gap-2">


          <button
            onClick={() =>
              onModeChange("markers")
            }
            className={`
            flex
            items-center
            gap-2
            rounded-lg
            px-3
            py-1.5
            text-sm
            font-bold

            ${
              mode === "markers"
              ?
              "bg-green-700 text-white"
              :
              "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }
            `}
          >

            <Users size={15}/>
            همه مشتریان

          </button>



          <button
            onClick={() =>
              onModeChange("regions")
            }
            className={`
            flex
            items-center
            gap-2
            rounded-lg
            px-3
            py-1.5
            text-sm
            font-bold

            ${
              mode === "regions"
              ?
              "bg-green-700 text-white"
              :
              "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }
            `}
          >

            <MapPinned size={15}/>
            مناطق دارای مشتری

          </button>


        </div>


      </div>


    </div>
  );
}