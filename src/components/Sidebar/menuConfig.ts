import {
  Home,
  BriefcaseBusiness,
  TrendingUp,

  Package,
  ShoppingCart,
  Warehouse,
  Megaphone,
  WalletCards,
  FileChartColumn,

  LayoutDashboard,
  UserRoundCheck,
  CalendarDays,
  MapPinned,
  Route,
  Gauge,

} from "lucide-react";


export const sidebarMenus = [

  

  {
    id: "business",
    title: "عملیات تجاری",
    icon: BriefcaseBusiness,
    
    children: [

      {
        title: "کالاها",
        icon: Package,
        path: "/products",
      },

      {
        title: "سفارشات",
        icon: ShoppingCart,
        path: "/orders",
      },

      {
        title: "انبار",
        icon: Warehouse,
        path: "/inventory",
      },

      {
        title: "بازاریابی",
        icon: Megaphone,
        path: "/marketing",
      },

      {
        title: "حسابداری",
        icon: WalletCards,
        path: "/accounting",
      },

      {
        title: "گزارش‌ها",
        icon: FileChartColumn,
        path: "/reports",
      },

    ],
     positionClass:"menu-business-position"
  },


  {
    id: "sales",
    title: "فروش هوشمند",
    icon: TrendingUp,

    children: [

      {
        title: "داشبورد فروش",
        icon: LayoutDashboard,
        path: "/sales",
      },

      {
        title: "مدیریت ویزیتورها",
        icon: UserRoundCheck,
        path: "/sales/visitors",
      },

      {
        title: "برنامه ویزیت",
        icon: CalendarDays,
        path: "/sales/visit-plan",
      },

      {
        title: "نقشه فروش",
        icon: MapPinned,
        path: "/sales/map",
      },

      {
        title: "مسیرها",
        icon: Route,
        path: "/sales/routes",
      },

      {
        title: "عملکرد و KPI",
        icon: Gauge,
        path: "/sales/performance",
      },

    ],
     positionClass:"menu-sales-position"
  },
  

];


