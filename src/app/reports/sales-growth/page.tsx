"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { ChevronDown } from "lucide-react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

type FilterKey =
  | "province"
  | "city"
  | "visitor"
  | "retention"
  | "churn"
  | "activeCustomers"
  | "targetCoverage"
  | "repeatPurchase"
  | "fullOrderSupply"
  | "lostSales"
  | "keyCustomerTrend"
  | "customerDebtDelay"
  | "overdueReceivables";

type ReportRow = {
  province: string;
  city: string;
  visitor: string;
  retention: string;
  churn: string;
  activeCustomers: string;
  targetCoverage: string;
  repeatPurchase: string;
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
  { key: "retention", label: "فروش به ازای هر مشتری", defaultWidth: 150 },
  { key: "churn", label: "سهم از خرید مشتری", defaultWidth: 150 },
  { key: "activeCustomers", label: "تعداد اقلام در هر سفارش", defaultWidth: 150 },
  { key: "targetCoverage", label: "نرخ تبدیل ویزیت به سفارش", defaultWidth: 150 },
  { key: "repeatPurchase", label: "فروش محصولات جدید", defaultWidth: 150 },
  { key: "fullOrderSupply", label: "فروش به مشتریان جدید", defaultWidth: 165 },
  { key: "lostSales", label: "رشد فروش مشتریان موجود", defaultWidth: 145 },
  { key: "keyCustomerTrend", label: "فروش از دست‌رفته قابل بازیابی", defaultWidth: 175 },
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
  retention: [],
  churn: [],
  activeCustomers: [],
  targetCoverage: [],
  repeatPurchase: [],
  fullOrderSupply: [],
  lostSales: [],
  keyCustomerTrend: [],
  customerDebtDelay: [],
  overdueReceivables: [],
};

// فعلاً داده‌ای برای جدول قرار نداده‌ایم.
// در مرحله بعد این بخش به داده‌های واقعی گزارش وصل می‌شود.
const initialRows: ReportRow[] = [];

function getCellValue(row: ReportRow, key: FilterKey) {
  return row[key] ?? "";
}

export default function SalesGrowthReportPage() {
  const [rows] = useState<ReportRow[]>(initialRows);

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

  function clearAllFilters() {
    setFilterSelections(EMPTY_FILTERS);
    setOpenFilter(null);
    setFilterSearch("");
    setSortKey(null);
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
        .map((key) => columns.find((column) => column.key === key))
        .filter(Boolean) as Array<{ key: FilterKey; label: string; defaultWidth: number }>,
    [columnOrder]
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

  function startResize(
    event: React.MouseEvent<HTMLDivElement>,
    key: FilterKey
  ) {
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

  function openFilterMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    key: FilterKey
  ) {
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
      setFilterSearch('');
      return;
    }

    setOpenFilter(key);
    setFilterMenuPosition({ top, left });
    setFilterSearch('');
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

  return (
    <AppShell>
      <PageHeader
        title="گزارش رشد فروش"
        subtitle="بررسی شاخص‌های رشد فروش به تفکیک "
      />

      <div
        style={{
          width: "min(760px, 100%)",
          height: 48,
          margin: "-90px auto 20px auto",
          padding: "5px 8px",
          display: "grid",
          gridTemplateColumns: "auto 1fr 1fr 1px auto 1fr 1fr",
          alignItems: "center",
          gap: 7,
          border: "1px solid #dfe8e2",
          borderRadius: 11,
          background: "#ffffff",
          boxShadow: "0 4px 12px rgba(15, 23, 42, 0.035)",
        }}
      >
        <div
          style={{
            color: "#173f2d",
            fontSize: 11,
            fontWeight: 900,
            whiteSpace: "nowrap",
            padding: "0 4px",
          }}
        >
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

        <div
          style={{
            color: "#173f2d",
            fontSize: 11,
            fontWeight: 900,
            whiteSpace: "nowrap",
            padding: "0 4px",
          }}
        >
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
      `}</style>

      <div
        className="panel"
        style={{
          width: "100%",
          minHeight: "calc(100vh - 270px)",
          padding: 0,
          overflow: "visible",
          background: "#ffffff",
        }}
      >
        <div
          ref={tableScrollRef}
          style={{
            width: "100%",
            overflowX: "auto",
            overflowY: "visible",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: 2050,
              borderCollapse: "separate",
              borderSpacing: 0,
              tableLayout: "fixed",
            }}
          >
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
                        background: selected.length
                          ? "#149b5c"
                          : "#f2f4f3",
                        color: selected.length ? "#fff" : "#1f2937",
                        fontSize: 12,
                        fontWeight: 900,
                        textAlign: "center",
                        verticalAlign: "middle",
                      }}
                    >
                      <button
                        type="button"
                        onClick={(event) =>
                          openFilterMenu(event, column.key)
                        }
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
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "normal",
                          }}
                        >
                          {selected.length
                            ? `${column.label} (${selected.length})`
                            : column.label}
                        </span>

                        <ChevronDown
                          size={14}
                          style={{
                            flex: "0 0 auto",
                            transform: isOpen ? "rotate(180deg)" : "none",
                            transition: "transform .15s ease",
                          }}
                        />
                      </button>

                      <div
                        onMouseDown={(event) => startResize(event, column.key)}
                        title="برای تغییر عرض بکشید"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: 6,
                          height: "100%",
                          cursor: "col-resize",
                          zIndex: 2,
                        }}
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
                  <td
                    colSpan={orderedColumns.length}
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: "#64748b",
                      fontSize: 13,
                    }}
                  >
                    هنوز داده‌ای برای نمایش در گزارش افت فروش ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
            const activeColumn = orderedColumns.find(
              (column) => column.key === openFilter
            );
            if (!activeColumn) return null;

            const selected = filterSelections[activeColumn.key];
            const values = getUniqueFilterValues(activeColumn.key).filter(
              (value) =>
                value
                  .toLocaleLowerCase("fa")
                  .includes(filterSearch.toLocaleLowerCase("fa"))
            );

            return (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => sortByFilter(activeColumn.key, "asc")}
                  >
                    مرتب‌سازی صعودی
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => sortByFilter(activeColumn.key, "desc")}
                  >
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

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    color: "#64748b",
                    fontSize: 12,
                  }}
                >
                  <span>انتخاب چند مقدار</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      style={{
                        border: 0,
                        background: "transparent",
                        color: "#0f6b43",
                        cursor: "pointer",
                        fontWeight: 800,
                      }}
                      onClick={() =>
                        setFilterSelections((current) => ({
                          ...current,
                          [activeColumn.key]: [
                            ...getUniqueFilterValues(activeColumn.key),
                          ],
                        }))
                      }
                    >
                      انتخاب همه
                    </button>
                    <button
                      type="button"
                      style={{
                        border: 0,
                        background: "transparent",
                        color: "#dc2626",
                        cursor: "pointer",
                        fontWeight: 800,
                      }}
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
                    <label
                      key={value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 4px",
                        cursor: "pointer",
                        borderRadius: 6,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(value)}
                        onChange={() =>
                          toggleFilterValue(activeColumn.key, value)
                        }
                      />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {value}
                      </span>
                    </label>
                  ))}

                  {values.length === 0 && (
                    <div
                      style={{
                        padding: 14,
                        textAlign: "center",
                        color: "#94a3b8",
                        fontSize: 12,
                      }}
                    >
                      مقداری برای فیلتر وجود ندارد
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      <div
        ref={bottomScrollRef}
        aria-label="اسکرول افقی جدول"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 17,
          zIndex: 12000,
          overflowX: "auto",
          overflowY: "hidden",
          background: "#ffffff",
          borderTop: "1px solid #cbd5e1",
          boxShadow: "0 -4px 12px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            width: 2050,
            height: 1,
          }}
        />
      </div>
    </AppShell>
  );
}
