"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { ChevronDown, CircleHelp, FileSpreadsheet, Printer } from "lucide-react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

type FilterKey =
  | "province"
  | "city"
  | "visitor"
  | "baseCustomerCount"
  | "commonCustomerCount"
  | "retention"
  | "churn"
  | "activeCustomerCount"
  | "totalCustomerCount"
  | "activeCustomers"
  | "compareCustomerCount"
  | "targetCoverage"
  | "repeatCustomerCount"
  | "repeatPurchase"
  | "fullOrderCompleteCount"
   | "totalOrderCount"
  | "fullOrderSupply"
  | "lostSales"
  | "keyCustomerTrend"
  | "customerDebtDelay"
  | "overdueReceivables";

type ReportRow = {
  province: string;
  city: string;
  visitor: string;
  baseCustomerCount: string;
  commonCustomerCount: string;
  retention: string;
  churn: string;
  activeCustomerCount: string;
  totalCustomerCount: string;
  activeCustomers: string;
  compareCustomerCount: string;
  targetCoverage: string;
  repeatCustomerCount: string;
  repeatPurchase: string;
  fullOrderCompleteCount: string;
  totalOrderCount: string;
  fullOrderSupply: string;
  lostSales: string;
  keyCustomerTrend: string;
  customerDebtDelay: string;
  overdueReceivables: string;
};

const columns: Array<{ key: FilterKey; label: string; defaultWidth: number }> = [
  { key: "province", label: "استان", defaultWidth: 120 },
  { key: "city", label: "شهر", defaultWidth: 120 },
  { key: "visitor", label: "ویزیتور", defaultWidth: 130 },
  { key: "baseCustomerCount", label: "مشتریان دوره مبنا", defaultWidth: 150 },
  { key: "commonCustomerCount", label: "مشتریان مشترک دو دوره", defaultWidth: 170 },
  { key: "retention", label: "نرخ حفظ مشتری", defaultWidth: 150 },
  { key: "churn", label: "نرخ ریزش مشتری", defaultWidth: 150 },
  { key: "activeCustomerCount", label: "تعداد مشتریان فعال\n(مستقل)", defaultWidth: 150 },
  { key: "totalCustomerCount", label: "تعداد کل مشتریان\n(مستقل)", defaultWidth: 150 },
  { key: "activeCustomers", label: "درصد مشتریان فعال\n(مستقل)", defaultWidth: 150 },
  { key: "compareCustomerCount", label: "تعداد مشتریان خرید کرده\n(مستقل)", defaultWidth: 170 },
  { key: "targetCoverage", label: "پوشش مشتریان فعال\n(مستقل)", defaultWidth: 150 },
  { key: "repeatCustomerCount", label: "تعداد مشتریان با حداقل 2 سفارش\n(مستقل)", defaultWidth: 210 },
  { key: "repeatPurchase", label: "نرخ تکرار خرید\n(مستقل)", defaultWidth: 150 },
  { key: "fullOrderCompleteCount", label: "تعداد سفارش‌های تحویلی کامل\n(مستقل)", defaultWidth: 190 },
  { key: "totalOrderCount", label: "تعداد کل سفارشات\n(مستقل)", defaultWidth: 150 },
  { key: "fullOrderSupply", label: "درصد تأمین کامل سفارش\n(مستقل)", defaultWidth: 165 },
  { key: "lostSales", label: "فروش از دست‌رفته", defaultWidth: 145 },
  { key: "keyCustomerTrend", label: "روند فروش مشتریان کلیدی", defaultWidth: 175 },
  {
    key: "customerDebtDelay",
    label: "میزان بدهی و تأخیر در تسویه مشتریان",
    defaultWidth: 210,
  },
  { key: "overdueReceivables", label: "مطالبات سررسیدگذشته", defaultWidth: 165 },
];

const EMPTY_FILTERS: Record<FilterKey, string[]> = {
  province: [],
  city: [],
  visitor: [],
  baseCustomerCount: [],
  commonCustomerCount: [],
  retention: [],
  churn: [],
  activeCustomerCount: [],
  totalCustomerCount: [],
  activeCustomers: [],
  compareCustomerCount: [],
  targetCoverage: [],
  repeatCustomerCount: [],
  repeatPurchase: [],
  fullOrderCompleteCount: [],
  totalOrderCount: [],
  fullOrderSupply: [],
  lostSales: [],
  keyCustomerTrend: [],
  customerDebtDelay: [],
  overdueReceivables: [],
};

const initialRows: ReportRow[] = [];

function getCellValue(row: ReportRow, key: FilterKey) {
  return row[key] ?? "";
}

export default function SalesDeclineReportPage() {
  const [rows, setRows] = useState<ReportRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [groupBy, setGroupBy] = useState<"visitor" | "province" | "city">("visitor");

  const [baseFromDate, setBaseFromDate] = useState<any>(null);
  const [baseToDate, setBaseToDate] = useState<any>(null);
  const [compareFromDate, setCompareFromDate] = useState<any>(null);
  const [compareToDate, setCompareToDate] = useState<any>(null);

  const [filterSelections, setFilterSelections] =
    useState<Record<FilterKey, string[]>>(EMPTY_FILTERS);

  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [sortKey, setSortKey] = useState<FilterKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [columnOrder, setColumnOrder] = useState<FilterKey[]>(
    columns.map((column) => column.key)
  );
  const [columnWidths, setColumnWidths] = useState<Record<FilterKey, number>>(
    Object.fromEntries(columns.map((column) => [column.key, column.defaultWidth])) as Record<
      FilterKey,
      number
    >
  );
  const [draggedColumn, setDraggedColumn] = useState<FilterKey | null>(null);
  const [filterMenuPosition, setFilterMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const resizeStateRef = useRef<{
    key: FilterKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  const normalize = (v: any) => String(v ?? "").trim().replace(/\s+/g, " ");

  const loadReportData = useCallback(async () => {
    if (!baseFromDate || !baseToDate || !compareFromDate || !compareToDate) {
      alert("لطفاً تمام تاریخ‌ها را وارد کنید");
      return;
    }

    setLoading(true);

    try {
      // تبدیل تاریخ شمسی به میلادی (YYYY-MM-DD)
      const baseStart = baseFromDate.toDate().toISOString().slice(0, 10);
      const baseEnd = baseToDate.toDate().toISOString().slice(0, 10);
      const compareStart = compareFromDate.toDate().toISOString().slice(0, 10);
      const compareEnd = compareToDate.toDate().toISOString().slice(0, 10);

      console.log("=== تاریخ‌های انتخاب شده ===");
      console.log("دوره مبنا:", baseStart, "تا", baseEnd);
      console.log("دوره مقایسه:", compareStart, "تا", compareEnd);

      // ۱. گرفتن مشتریان
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("id, visitor, province, city, active, customer_type, customer_group_id");

      if (customersError) throw customersError;
      console.log("تعداد مشتریان:", customers?.length);

      // ۲. گرفتن سفارش‌ها (از warehouse_send_date استفاده می‌کنیم)
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, customer_id, invoice_total, warehouse_send_date");

      if (ordersError) throw ordersError;
      console.log("تعداد کل سفارش‌ها:", orders?.length);

      const { data: orderItems, error: orderItemsError } = await supabase
        .from("order_items")
        .select("order_id, quantity, final_order_quantity");

      if (orderItemsError) throw orderItemsError;

      // نمونه چند تا تاریخ واقعی برای دیباگ
      if (orders && orders.length > 0) {
        console.log("نمونه تاریخ‌های warehouse_send_date:", 
          orders.slice(0, 5).map((o: any) => o.warehouse_send_date)
        );
      }

      const customerMap = new Map((customers ?? []).map((c: any) => [c.id, c]));

      // تعداد اعضای هر گروه زنجیره‌ای
      // در ساختار دیتابیس، مادر و شعبه‌ها customer_group_id مشترک دارند.
      // بنابراین از هر گروه زنجیره‌ای فقط یک رکورد (مادر) باید حذف شود.
      const chainGroupCounts = new Map<string, number>();

      (customers ?? []).forEach((customer: any) => {
        if (customer.customer_type === "زنجیره‌ای" && customer.customer_group_id) {
          chainGroupCounts.set(
            customer.customer_group_id,
            (chainGroupCounts.get(customer.customer_group_id) || 0) + 1
          );
        }
      });

      const chainParentIds = new Set<string>();

      (customers ?? []).forEach((customer: any) => {
        if (
          customer.customer_type === "زنجیره‌ای" &&
          customer.customer_group_id
        ) {
          const sameGroup = (customers ?? []).filter(
            (c:any) => c.customer_group_id === customer.customer_group_id
          );

          // مادر زنجیره‌ای همان رکوردی است که زیرمجموعه خودش را ندارد
          // و اولین رکورد گروه است. فقط همان یکی حذف می‌شود.
          if (sameGroup.length > 1 && sameGroup[0]?.id === customer.id) {
            chainParentIds.add(customer.id);
          }
        }
      });

      const groups = new Map<string, any>();

      // ساخت گروه‌ها
      (customers ?? []).forEach((customer: any) => {
        // فقط مشتریان نهایی (زیرمجموعه‌ها) در KPIها محاسبه می‌شوند
        

        const visitor = normalize(customer.visitor || "بدون ویزیتور");
        const province = normalize(customer.province || "بدون استان");
        const city = normalize(customer.city || "بدون شهر");

        const key =
          groupBy === "visitor" ? visitor : groupBy === "province" ? province : city;

        if (!groups.has(key)) {
          groups.set(key, {
            visitor,
            province,
            city,
            totalCustomers: 0,
            activeCustomersNow: 0,
            baseCustomers: new Set<string | number>(),
            compareCustomers: new Set<string | number>(),
            compareOrderCounts: new Map<string | number, number>(),
            compareTotalOrders: 0,
            compareOrders: new Set<string | number>(),
            baseSales: 0,
            compareSales: 0,
          });
        }

        // مشتری مادر زنجیره‌ای در KPI مشتریان نباید محاسبه شود
        // فقط شعبه‌های زیرمجموعه باید شمارش شوند
        // فقط شعبه‌های زنجیره‌ای حساب می‌شوند؛ رکورد مادر حذف می‌شود.
        if (chainParentIds.has(customer.id)) {
          return;
        }

        const group = groups.get(key);
        group.totalCustomers++;
        if (customer.active === true) {
          group.activeCustomersNow++;
        }
      });

      // پردازش سفارش‌ها
      let matchedBaseOrders = 0;

      (orders ?? []).forEach((order: any) => {
        const customer = customerMap.get(order.customer_id);
        if (!customer || !order.warehouse_send_date) return;

        // تاریخ را به فرمت YYYY-MM-DD تبدیل می‌کنیم
        const date = String(order.warehouse_send_date).slice(0, 10);

        const visitor = normalize(customer.visitor || "بدون ویزیتور");
        const province = normalize(customer.province || "بدون استان");
        const city = normalize(customer.city || "بدون شهر");

        const key =
          groupBy === "visitor" ? visitor : groupBy === "province" ? province : city;

        const row = groups.get(key);
        if (!row) return;

        // فقط دوره مبنا را فعلاً حساب می‌کنیم
        if (date >= baseStart && date <= baseEnd) {
          row.baseCustomers.add(order.customer_id);
          row.baseSales += Number(order.invoice_total || 0);
          matchedBaseOrders++;
        }

        // دوره مقایسه (فعلاً نگه می‌داریم)
        if (date >= compareStart && date <= compareEnd) {
          row.compareTotalOrders++;
          row.compareCustomers.add(order.customer_id);
          row.compareOrderCounts.set(
            order.customer_id,
            (row.compareOrderCounts.get(order.customer_id) || 0) + 1
          );
          row.compareSales += Number(order.invoice_total || 0);

          const items = (orderItems ?? []).filter((item: any) => item.order_id === order.id);
          const isComplete = items.length > 0 && items.every(
            (item: any) => Number(item.quantity || 0) >= Number(item.final_order_quantity || 0)
          );

          if (isComplete) {
            row.compareOrders.add(order.id);
          }
        }
      });

      console.log("تعداد سفارش‌های منطبق با دوره مبنا:", matchedBaseOrders);

      // ساخت ردیف‌های نهایی
      const result: ReportRow[] = Array.from(groups.values())
        .map((r: any) => {
          const common = [...r.baseCustomers].filter((id) =>
            r.compareCustomers.has(id)
          ).length;

          const retentionPercent = r.baseCustomers.size
            ? Math.round((common / r.baseCustomers.size) * 100)
            : 0;

          const repeatCustomerCount = [...r.compareOrderCounts.values()].filter((count: any) => count >= 2).length;
          const repeatPurchasePercent = r.compareCustomers.size
            ? Math.round((repeatCustomerCount / r.compareCustomers.size) * 100)
            : 0;

          return {
            province: groupBy === "province" ? r.province : "",
            city: groupBy === "city" ? r.city : "",
            visitor: groupBy === "visitor" ? r.visitor : "",
            baseCustomerCount: String(r.baseCustomers.size), // ← این ستون مد نظر توست
            commonCustomerCount: String(common),
            retention: `${retentionPercent}%`,
            churn: `${100 - retentionPercent}%`,
            activeCustomerCount: String(r.activeCustomersNow),
            totalCustomerCount: String(r.totalCustomers),
            activeCustomers: `${
              r.totalCustomers > 0
                ? Math.round((r.activeCustomersNow / r.totalCustomers) * 100)
                : 0
            }%`,
            compareCustomerCount: String(r.compareCustomers.size),
             targetCoverage: `${r.activeCustomersNow > 0 ? Math.round((r.compareCustomers.size / r.activeCustomersNow) * 100) : 0}%`,
            repeatCustomerCount: String(repeatCustomerCount),
             repeatPurchase: `${repeatPurchasePercent}%`,
            totalOrderCount: String(r.compareTotalOrders),
            fullOrderCompleteCount: String(r.compareOrders?.size || 0),
            fullOrderSupply: `${r.compareTotalOrders > 0 ? Math.round(((r.compareOrders?.size || 0) / r.compareTotalOrders) * 100) : 0}%`,
            lostSales: Math.max(r.baseSales - r.compareSales, 0).toLocaleString("fa-IR"),
            keyCustomerTrend: r.compareSales.toLocaleString("fa-IR"),
            customerDebtDelay: "-",
            overdueReceivables: "-",
          };
        })
        // فقط ردیف‌هایی که حداقل یک مشتری در دوره مبنا دارند را نشان بده (اختیاری)
        .filter((row) => Number(row.baseCustomerCount) > 0);

      console.log("نتیجه نهایی:", result);

      setRows(result);
    } catch (e: any) {
      console.error("خطا:", e);
      alert(e.message || "خطا در بارگذاری گزارش");
    } finally {
      setLoading(false);
    }
  }, [baseFromDate, baseToDate, compareFromDate, compareToDate, groupBy]);

  // ... بقیه کد دقیقاً مثل قبل (فیلترها، جدول، دکمه اکسل و ...) بدون تغییر

  function getUniqueFilterValues(key: FilterKey) {
    return Array.from(
      new Set(
        rows
          .map((row) => getCellValue(row, key))
          .map((value) => value.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "fa"));
  }

  function toggleFilterValue(key: FilterKey, value: string) {
    setFilterSelections((current) => {
      const selected = current[key];
      return {
        ...current,
        [key]: selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value],
      };
    });
  }

  function sortByFilter(key: FilterKey, direction: "asc" | "desc") {
    setSortKey(key);
    setSortDirection(direction);
  }

  useEffect(() => {
    const tableScroll = tableScrollRef.current;
    const bottomScroll = bottomScrollRef.current;

    if (!tableScroll || !bottomScroll) return;

    const syncFromTable = () => {
      if (bottomScroll.scrollLeft !== tableScroll.scrollLeft) {
        bottomScroll.scrollLeft = tableScroll.scrollLeft;
      }
    };

    const syncFromBottom = () => {
      if (tableScroll.scrollLeft !== bottomScroll.scrollLeft) {
        tableScroll.scrollLeft = bottomScroll.scrollLeft;
      }
    };

    tableScroll.addEventListener("scroll", syncFromTable);
    bottomScroll.addEventListener("scroll", syncFromBottom);

    return () => {
      tableScroll.removeEventListener("scroll", syncFromTable);
      bottomScroll.removeEventListener("scroll", syncFromBottom);
    };
  }, []);

  useEffect(() => {
    const bottomScroll = bottomScrollRef.current;
    if (!bottomScroll) return;
    bottomScroll.scrollLeft = tableScrollRef.current?.scrollLeft || 0;
  }, [columnWidths, columnOrder]);

  const filteredRows = useMemo(() => {
    const result = rows.filter((row) =>
      columns.every(({ key }) => {
        const selected = filterSelections[key];
        if (selected.length === 0) return true;
        return selected.includes(getCellValue(row, key));
      })
    );

    if (!sortKey) return result;

    return [...result].sort((a, b) => {
      const av = getCellValue(a, sortKey);
      const bv = getCellValue(b, sortKey);
      const compare = av.localeCompare(bv, "fa", {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? compare : -compare;
    });
  }, [rows, filterSelections, sortKey, sortDirection]);

  const orderedColumns = useMemo(
    () =>
      columnOrder
        .filter((key) => {
          if (groupBy === "visitor") return key !== "province" && key !== "city";
          if (groupBy === "province") return key !== "visitor" && key !== "city";
          if (groupBy === "city") return key !== "visitor" && key !== "province";
          return true;
        })
        .map((key) => columns.find((column) => column.key === key))
        .filter(Boolean) as Array<{
        key: FilterKey;
        label: string;
        defaultWidth: number;
      }>,
    [columnOrder, groupBy]
  );

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      const state = resizeStateRef.current;
      if (!state) return;

      const nextWidth = Math.max(90, state.startWidth + (state.startX - event.clientX));

      setColumnWidths((current) => ({
        ...current,
        [state.key]: nextWidth,
      }));
    }

    function handleMouseUp() {
      resizeStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  function startResize(event: React.MouseEvent<HTMLDivElement>, key: FilterKey) {
    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      key,
      startX: event.clientX,
      startWidth: columnWidths[key],
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function openFilterMenu(event: React.MouseEvent<HTMLButtonElement>, key: FilterKey) {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 320;
    const menuHeight = 330;
    const gap = 6;

    let left = rect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    let top = rect.bottom + gap;
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - gap);
    }

    if (openFilter === key) {
      setOpenFilter(null);
      setFilterMenuPosition(null);
      setFilterSearch("");
      return;
    }

    setOpenFilter(key);
    setFilterMenuPosition({ top, left });
    setFilterSearch("");
  }

  function handleColumnDrop(targetKey: FilterKey) {
    if (!draggedColumn || draggedColumn === targetKey) {
      setDraggedColumn(null);
      return;
    }

    setColumnOrder((current) => {
      const next = current.filter((key) => key !== draggedColumn);
      const targetIndex = next.indexOf(targetKey);
      next.splice(targetIndex, 0, draggedColumn);
      return next;
    });

    setDraggedColumn(null);
  }

  function exportExcel() {
    const headers = orderedColumns.map((c) => c.label);
    const data = filteredRows.map((row) =>
      orderedColumns.map((c) => getCellValue(row, c.key))
    );

    const csv = [headers, ...data]
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "گزارش-افت-فروش.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <PageHeader
        title="گزارش افت فروش"
        subtitle="بررسی شاخص‌های افت فروش به تفکیک"
      />

      {/* بقیه UI دقیقاً مثل قبل */}
      <div
        style={{
          width: "min(1000px, 100%)",
          height: 48,
          margin: "-90px 230px  38px auto",
          padding: "5px 8px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "nowrap",
          direction: "rtl",
          border: "1px solid #dfe8e2",
          borderRadius: 11,
          background: "#312f2f09",
          boxShadow: "0 4px 12px rgba(15, 23, 42, 0.035)",
        }}
      >
        <div style={{ color: "#173f2d", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap", padding: "0 4px" }}>
          دوره مبنا
        </div>

        <DatePicker
          value={baseFromDate}
          onChange={setBaseFromDate}
          calendar={persian}
          locale={persian_fa}
          format="YYYY/MM/DD"
          calendarPosition="bottom-right"
          portal
          placeholder="از تاریخ"
          inputClass="report-date-input"
          style={{ width: "100%", height: 28, fontSize: 10 }}
        />

        <DatePicker
          value={baseToDate}
          onChange={setBaseToDate}
          calendar={persian}
          locale={persian_fa}
          format="YYYY/MM/DD"
          calendarPosition="bottom-right"
          portal
          placeholder="تا تاریخ"
          inputClass="report-date-input"
          style={{ width: "100%", height: 28, fontSize: 10 }}
        />

        <div style={{ width: 1, height: 26, background: "#e6ece8" }} />

        <div style={{ color: "#173f2d", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap", padding: "0 4px" }}>
          دوره مقایسه
        </div>

        <DatePicker
          value={compareFromDate}
          onChange={setCompareFromDate}
          calendar={persian}
          locale={persian_fa}
          format="YYYY/MM/DD"
          calendarPosition="bottom-right"
          portal
          placeholder="از تاریخ"
          inputClass="report-date-input"
          style={{ width: "100%", height: 28, fontSize: 10 }}
        />

        <DatePicker
          value={compareToDate}
          onChange={setCompareToDate}
          calendar={persian}
          locale={persian_fa}
          format="YYYY/MM/DD"
          calendarPosition="bottom-right"
          portal
          placeholder="تا تاریخ"
          inputClass="report-date-input"
          style={{ width: "100%", height: 28, fontSize: 10 }}
        />

        <div style={{ color: "#173f2d", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap", padding: "0 4px" }}>
          سطح گزارش
        </div>

        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as "visitor" | "province" | "city")}
          style={{
            height: 30,
            border: "1px solid #dbe4df",
            borderRadius: 8,
            padding: "0 10px",
            fontSize: 12,
            fontWeight: 800,
            color: "#173f2d",
          }}
        >
          <option value="visitor">ویزیتور</option>
          <option value="province">استان</option>
          <option value="city">شهر</option>
        </select>

        <button
          type="button"
          onClick={loadReportData}
          disabled={loading}
          style={{
            background: "#149b5c",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            height: 30,
            padding: "0 16px",
            fontSize: 12,
            fontWeight: 900,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "در حال اجرا..." : "اجرا"}
        </button>

        <button
          type="button"
          title="خروجی اکسل"
          onClick={exportExcel}
          style={{
            background: "#ffffff",
            color: "#149b5c",
            border: "1px solid #149b5c",
            borderRadius: 8,
            height: 30,
            width: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <FileSpreadsheet size={17} />
        </button>

        <button
          type="button"
          title="چاپ گزارش"
          onClick={() => window.print()}
          style={{
            background: "#ffffff",
            color: "#149b5c",
            border: "1px solid #149b5c",
            borderRadius: 8,
            height: 30,
            width: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Printer size={17} />
        </button>

        <button
          type="button"
          onClick={() => setShowGuide(true)}
          style={{
            background: "#ffffff",
            color: "#149b5c",
            border: "1px solid #149b5c",
            borderRadius: 8,
            height: 30,
            width: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          title="راهنمای شاخص‌ها"
        >
          <CircleHelp size={18} />
        </button>
      </div>

      <style jsx global>{`
        .report-date-input {
          width: 100% !important;
          height: 28px !important;
          min-height: 28px !important;
          box-sizing: border-box !important;
          border: 1px solid #dbe4df !important;
          border-radius: 7px !important;
          background: #fbfdfc !important;
          color: #334155 !important;
          font-size: 10px !important;
          text-align: center !important;
        }
        .report-date-input::placeholder {
          color: #94a3b8 !important;
          opacity: 1 !important;
        }
        @media print {
          body * { visibility: hidden; }
          .panel, .panel * { visibility: visible; }
          .panel { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="panel" style={{ width: "100%", minHeight: "calc(100vh - 270px)", padding: 0, overflow: "visible", background: "#ffffff" }}>
        <div ref={tableScrollRef} style={{ width: "100%", overflowX: "auto", overflowY: "visible", scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <table style={{ width: "100%", minWidth: orderedColumns.reduce((sum, column) => sum + columnWidths[column.key], 0), borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
            <thead>
              <tr>
                {orderedColumns.map((column) => {
                  const isOpen = openFilter === column.key;
                  const selected = filterSelections[column.key];

                  return (
                    <th
                      key={column.key}
                      draggable
                      onDragStart={() => setDraggedColumn(column.key)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleColumnDrop(column.key)}
                      style={{
                        position: "relative",
                        width: columnWidths[column.key],
                        minWidth: columnWidths[column.key],
                        padding: 0,
                        borderBottom: "1px solid #cfd6d2",
                        borderLeft: "1px solid #cfd6d2",
                        background: selected.length ? "#149b5c" : "#f2f4f3",
                        color: selected.length ? "#fff" : "#1f2937",
                        fontSize: 12,
                        fontWeight: 900,
                        textAlign: "center",
                        verticalAlign: "middle",
                      }}
                    >
                      <button
                        type="button"
                        onClick={(event) => openFilterMenu(event, column.key)}
                        style={{
                          width: "100%",
                          minHeight: 62,
                          border: 0,
                          borderRadius: 0,
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          padding: "8px 9px",
                          fontWeight: 900,
                          fontSize: 12,
                          lineHeight: 1.6,
                        }}
                        title={`فیلتر ${column.label}`}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "normal" }}>
                          {selected.length ? `${column.label} (${selected.length})` : column.label}
                        </span>
                        <ChevronDown size={14} style={{ flex: "0 0 auto", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s ease" }} />
                      </button>
                      <div
                        onMouseDown={(event) => startResize(event, column.key)}
                        title="برای تغییر عرض بکشید"
                        style={{ position: "absolute", top: 0, left: 0, width: 6, height: "100%", cursor: "col-resize", zIndex: 2 }}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row, rowIndex) => (
                <tr key={`${row.province}-${row.city}-${row.visitor}-${rowIndex}`}>
                  {orderedColumns.map((column) => (
                    <td
                      key={column.key}
                      style={{
                        width: columnWidths[column.key],
                        minWidth: columnWidths[column.key],
                        padding: "13px 10px",
                        borderBottom: "1px solid #e2e8f0",
                        borderLeft: "1px solid #e2e8f0",
                        color: "#334155",
                        fontSize: 12,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getCellValue(row, column.key) || "—"}
                    </td>
                  ))}
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={orderedColumns.length} style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                    هنوز داده‌ای برای نمایش در گزارش افت فروش ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* منوی فیلتر و راهنما مثل قبل */}
      {openFilter && filterMenuPosition && (
        <div
          style={{
            position: "fixed",
            top: filterMenuPosition.top,
            left: filterMenuPosition.left,
            width: 320,
            maxHeight: "calc(100vh - 24px)",
            overflowY: "auto",
            zIndex: 50000,
            padding: 10,
            border: "1px solid #cfd6d2",
            borderRadius: 10,
            background: "#ffffff",
            boxShadow: "0 18px 40px rgba(15,23,42,.18)",
            color: "#1f2937",
            textAlign: "right",
          }}
        >
          {(() => {
            const activeColumn = orderedColumns.find((column) => column.key === openFilter);
            if (!activeColumn) return null;

            const selected = filterSelections[activeColumn.key];
            const values = getUniqueFilterValues(activeColumn.key).filter((value) =>
              value.toLocaleLowerCase("fa").includes(filterSearch.toLocaleLowerCase("fa"))
            );

            return (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => sortByFilter(activeColumn.key, "asc")}>
                    مرتب‌سازی صعودی
                  </button>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => sortByFilter(activeColumn.key, "desc")}>
                    مرتب‌سازی نزولی
                  </button>
                </div>

                <input
                  className="input"
                  placeholder={`جستجو در ${activeColumn.label}...`}
                  value={filterSearch}
                  onChange={(event) => setFilterSearch(event.target.value)}
                  style={{ marginBottom: 8 }}
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, color: "#64748b", fontSize: 12 }}>
                  <span>انتخاب چند مقدار</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      style={{ border: 0, background: "transparent", color: "#0f6b43", cursor: "pointer", fontWeight: 800 }}
                      onClick={() =>
                        setFilterSelections((current) => ({
                          ...current,
                          [activeColumn.key]: [...getUniqueFilterValues(activeColumn.key)],
                        }))
                      }
                    >
                      انتخاب همه
                    </button>
                    <button
                      type="button"
                      style={{ border: 0, background: "transparent", color: "#dc2626", cursor: "pointer", fontWeight: 800 }}
                      onClick={() =>
                        setFilterSelections((current) => ({
                          ...current,
                          [activeColumn.key]: [],
                        }))
                      }
                    >
                      پاک‌کردن
                    </button>
                  </div>
                </div>

                <div style={{ maxHeight: 240, overflowY: "auto" }}>
                  {values.map((value) => (
                    <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 4px", cursor: "pointer", borderRadius: 6 }}>
                      <input type="checkbox" checked={selected.includes(value)} onChange={() => toggleFilterValue(activeColumn.key, value)} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
                    </label>
                  ))}
                  {values.length === 0 && (
                    <div style={{ padding: 14, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>مقداری برای فیلتر وجود ندارد</div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {showGuide && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", zIndex: 60000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setShowGuide(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(700px, 95vw)", maxHeight: "80vh", overflowY: "auto", background: "#fff", borderRadius: 14, padding: 24, direction: "rtl", color: "#1f2937" }}>
            <h3 style={{ marginTop: 0 }}>راهنمای شاخص‌های گزارش افت فروش</h3>
            <p><b>مشتریان دوره مبنا</b><br />تعداد مشتریانی که در بازه زمانی دوره مبنا به آن‌ها بار داده شده است.</p>
            <p><b>نرخ حفظ مشتری</b><br />تعداد مشتریانی که در هر دو دوره خرید کرده‌اند ÷ تعداد مشتریان دوره مبنا × 100</p>
            <p><b>نرخ ریزش مشتری</b><br />100 - نرخ حفظ مشتری</p>
            <p><b>تعداد سفارش‌های تحویلی کامل</b><br />تعداد سفارش‌هایی که تمام ردیف‌های کالایی آن‌ها دقیقاً مطابق مقدار سفارش داده شده تحویل شده است. حتی کسری یک عدد از یک قلم کالا باعث می‌شود سفارش کامل محسوب نشود.</p>
            
            <p><b>درصد تأمین کامل سفارش</b><br />تعداد سفارش‌های تحویلی کامل ÷ کل سفارش‌ها × 100</p>
            <button onClick={() => setShowGuide(false)} style={{ background: "#149b5c", color: "#fff", border: 0, borderRadius: 8, padding: "8px 20px", cursor: "pointer" }}>
              بستن
            </button>
          </div>
        </div>
      )}

      <div
        ref={bottomScrollRef}
        aria-label="اسکرول افقی جدول"
        style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 17, zIndex: 12000, overflowX: "auto", overflowY: "hidden", background: "#ffffff", borderTop: "1px solid #cbd5e1", boxShadow: "0 -4px 12px rgba(15, 23, 42, 0.08)" }}
      >
        <div style={{ width: orderedColumns.reduce((sum, column) => sum + columnWidths[column.key], 0), height: 1 }} />
      </div>
    </AppShell>
  );
}