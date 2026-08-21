"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Plus, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import DataTable, {
  DataTableColumn,
} from "@/components/DataTable/DataTable";
import { supabase } from "@/lib/supabase";

type ReturnSource = {
  return_id: string;
  source_order_id: string | null;
};

type ReturnDocument = {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  visitor: string | null;
  status: string | null;
  total_amount: number | null;
  description: string | null;
  created_at: string;
};

type Customer = {
  id: string;
  name: string | null;
  province: string | null;
};

type Order = {
  id: string;
  order_number: string | number | null;
};

type ReturnRow = {
  id: string;
  documentNumber: string;
  customer: string;
  province: string;
  visitor: string;
  orderNumber: string;
  createdAt: string;
  totalAmount: number;
  status: string;
};

type ReturnFilterKey =
  | "customer"
  | "province"
  | "visitor"
  | "createdAt"
  | "totalAmount"
  | "status";

type FilterSelections = Record<ReturnFilterKey, string[]>;

const emptyFilters: FilterSelections = {
  customer: [],
  province: [],
  visitor: [],
  createdAt: [],
  totalAmount: [],
  status: [],
};

function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
  }).format(date);
}

function money(value: number | null | undefined) {
  const amount = Number(value || 0);
  return `${toPersianDigits(
    amount.toLocaleString("en-US")
  )} ریال`;
}

function statusInfo(status: string | null | undefined) {
  switch (String(status || "").toLowerCase()) {
    case "approved":
      return {
        label: "تایید شده",
        className: "badge-success",
      };
    case "delivered":
      return {
        label: "تحویل انبار",
        className: "badge-success",
      };
    
    case "pending":
    default:
      return {
        label: "در انتظار تایید",
        className: "badge-warning",
      };
      case "cancelled":
  return {
    label: "باطل شده",
    background: "#fee2e2",
    color: "#b91c1c"
  };
  }
}

export default function ReturnsListPage() {
  const router = useRouter();

  const [documents, setDocuments] = useState<ReturnDocument[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [returnSources, setReturnSources] = useState<ReturnSource[]>([]);

  const [loading, setLoading] = useState(true);

  const [openFilter, setOpenFilter] =
    useState<ReturnFilterKey | null>(null);

  const [filterSearch, setFilterSearch] = useState("");

  const [filterSelections, setFilterSelections] =
    useState<FilterSelections>(emptyFilters);

  const [sortKey, setSortKey] =
    useState<ReturnFilterKey | null>(null);

  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("asc");

  useEffect(() => {
    loadReturns();
  }, []);

  async function loadReturns() {
    setLoading(true);

    try {
      const [
        { data: returnRows, error: returnError },
        { data: customerRows, error: customerError },
        { data: orderRows, error: orderError },
        { data: sourceRows, error: sourceError },
      ] = await Promise.all([
        supabase
          .from("return_documents")
          .select(
            "id,customer_id,order_id,visitor,status,total_amount,description,created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("customers")
          .select("id,name,province"),

        supabase
          .from("orders")
          .select("id,order_number"),

        supabase
          .from("return_items")
          .select("return_id,source_order_id"),
      ]);

      if (returnError) throw returnError;
      if (customerError) throw customerError;
      if (orderError) throw orderError;
      if (sourceError) throw sourceError;

      setDocuments((returnRows || []) as ReturnDocument[]);
      setReturnSources((sourceRows || []) as ReturnSource[]);
      setCustomers((customerRows || []) as Customer[]);
      setOrders((orderRows || []) as Order[]);
    } catch (error: any) {
      console.error(error);
      alert(
        `خطا در دریافت لیست مرجوعیات: ${
          error?.message || "نامشخص"
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  const customerMap = useMemo(
    () =>
      new Map(
        customers.map((customer) => [
          customer.id,
          customer,
        ])
      ),
    [customers]
  );

  const orderMap = useMemo(
    () =>
      new Map(
        orders.map((order) => [
          order.id,
          order,
        ])
      ),
    [orders]
  );

  const rows: ReturnRow[] = useMemo(() => {
    return documents.map((document, index) => {
      const customer = document.customer_id
        ? customerMap.get(document.customer_id)
        : undefined;

      const order = document.order_id
        ? orderMap.get(document.order_id)
        : undefined;

const sourceOrderNumbers = returnSources
  .filter(
    (item) => item.return_id === document.id
  )
  .map(
    (item) =>
      orderMap.get(item.source_order_id || "")
        ?.order_number
  )
  .filter(Boolean)
  .map(String);


      return {
        id: document.id,

        // شماره سند در حال حاضر از شناسه ثبت‌شده ساخته می‌شود؛
        // به ساختار دیتابیس جدیدی برای شماره‌گذاری نیاز نیست.
        documentNumber:
          documents.length - index > 0
            ? toPersianDigits(documents.length - index)
            : "-",

        customer: customer?.name || "-",
        province: customer?.province || "-",
        visitor: document.visitor || "-",

        orderNumber:
  sourceOrderNumbers.length > 0
    ? sourceOrderNumbers.join(" - ")
    : order?.order_number
      ? String(order.order_number)
      : "-",
        createdAt: formatDate(document.created_at),

        totalAmount: Number(
          document.total_amount || 0
        ),

        status: document.status || "pending",
      };
    });
  }, [documents, customerMap, orderMap, returnSources]);

  const filterLabels: Record<
    ReturnFilterKey,
    string
  > = {
    customer: "مشتری",
    province: "استان",
    visitor: "ویزیتور",
    createdAt: "تاریخ ثبت",
    totalAmount: "مبلغ مرجوعی",
    status: "وضعیت",
  };

  function getFilterValue(
    row: ReturnRow,
    key: ReturnFilterKey
  ) {
    if (key === "customer") return row.customer;
    if (key === "province") return row.province;
    if (key === "visitor") return row.visitor;
    if (key === "createdAt") return row.createdAt;
    if (key === "status")
      return statusInfo(row.status).label;

    return money(row.totalAmount);
  }

  function getUniqueFilterValues(
    key: ReturnFilterKey
  ) {
    return Array.from(
      new Set(
        rows
          .map((row) =>
            getFilterValue(row, key)
          )
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b, "fa", {
        numeric: true,
      })
    );
  }

  function toggleFilterValue(
    key: ReturnFilterKey,
    value: string
  ) {
    setFilterSelections((current) => {
      const selected = current[key];

      return {
        ...current,
        [key]: selected.includes(value)
          ? selected.filter(
              (item) => item !== value
            )
          : [...selected, value],
      };
    });
  }

  function clearAllFilters() {
    setFilterSelections({
      customer: [],
      province: [],
      visitor: [],
      createdAt: [],
      totalAmount: [],
      status: [],
    });

    setOpenFilter(null);
    setFilterSearch("");
    setSortKey(null);
    setSortDirection("asc");
  }

  function sortBy(
    key: ReturnFilterKey,
    direction: "asc" | "desc"
  ) {
    setSortKey(key);
    setSortDirection(direction);
  }

  const filteredRows = useMemo(() => {
    return [...rows]
      .filter((row) =>
        (
          Object.keys(
            filterSelections
          ) as ReturnFilterKey[]
        ).every((key) => {
          const selected =
            filterSelections[key];

          if (!selected.length) return true;

          return selected.includes(
            getFilterValue(row, key)
          );
        })
      )
      .sort((a, b) => {
        if (!sortKey) return 0;

        const av = getFilterValue(
          a,
          sortKey
        );
        const bv = getFilterValue(
          b,
          sortKey
        );

        const result = av.localeCompare(
          bv,
          "fa",
          { numeric: true }
        );

        return sortDirection === "asc"
          ? result
          : -result;
      });
  }, [
    rows,
    filterSelections,
    sortKey,
    sortDirection,
  ]);

  const tableColumns: DataTableColumn<ReturnRow>[] =
    [
      {
        key: "documentNumber",
        title: "کد سند",
        width: 80,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) =>
          row.documentNumber,
        render: (value) => (
          <strong>
            {String(value || "-")}
          </strong>
        ),
      },

      {
        key: "documentType",
        title: "نوع سند",
        width: 100,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: () => "مرجوعی",
        render: () => (
          <span
            className="badge"
            style={{
              background: "#fff7ed",
              color: "#c2410c",
            }}
          >
            مرجوعی
          </span>
        ),
      },

      {
        key: "orderNumber",
        title: "سفارش مبنا",
        width: 180,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) =>
          row.orderNumber,
        render: (value) =>
          String(value || "-"),
      },

      {
        key: "customer",
        title: "مشتری",
        width: 150,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) =>
          row.customer,
        render: (value) =>
          String(value || "-"),
      },

      {
        key: "createdAt",
        title: "تاریخ ثبت",
        width: 125,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) =>
          row.createdAt,
        render: (value) =>
          String(value || "-"),
      },

      {
        key: "totalAmount",
        title: "مبلغ مرجوعی",
        width: 140,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) =>
          row.totalAmount,
        render: (value) =>
          money(Number(value || 0)),
      },

      {
        key: "status",
        title: "وضعیت",
        width: 110,
        filterable: false,
        searchable: true,
        sortable: false,
        accessor: (row) =>
          statusInfo(row.status).label,
        render: (_value, row) => {
          const status = statusInfo(
            row.status
          );

          return (
            <span
              className={`badge ${status.className}`}
            >
              {status.label}
            </span>
          );
        },
      },

      {
        key: "actions",
        title: "عملیات",
        width: 80,
        filterable: false,
        searchable: false,
        sortable: false,
        accessor: () => "",
        render: (_value, row) => (
          <button
            type="button"
            className="btn btn-secondary btn-small"
            title="مشاهده سند مرجوعی"
            onClick={() =>
              router.push(
                `/returns/${row.id}`
              )
            }
            style={{
              width: 32,
              height: 32,
              padding: 0,
              justifyContent: "center",
            }}
          >
            <Eye size={15} />
          </button>
        ),
      },
    ];

  return (
    <>
      <style jsx global>{`
        .returns-page-compact table {
          width: 100% !important;
          table-layout: fixed !important;
        }

        .returns-page-compact th,
        .returns-page-compact td,
        .returns-page-compact td > div,
        .returns-page-compact td > span {
          padding: 8px 6px !important;
          font-size: 13px !important;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center !important;
          vertical-align: middle !important;
        }

        .returns-page-compact td > div {
          justify-content: center !important;
        }

        .returns-page-compact
          .table-wrap {
          width: 100% !important;
          overflow-x: hidden !important;
        }

        .returns-page-compact
          .data-table-header {
          width: 100% !important;
          justify-content: center !important;
        }
      `}</style>

      <AppShell>
        <PageHeader
          title="مرجوعیات"
          subtitle="ثبت، بررسی و مدیریت اسناد مرجوعی مشتریان"
          action={
            <button
              className="btn btn-primary btn-small"
              onClick={() =>
                  router.push("/returns/new")
              }
            >
              <Plus size={12} />
              ثبت مرجوعی جدید
            </button>
          }
        />

        {/* نوار فیلتر؛ همان ساختار صفحه سفارشات */}
        <div
          dir="rtl"
          style={{
            width: "100%",
            marginBottom: 12,
            marginTop: -24,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "78%",
              display: "flex",
              alignItems: "stretch",
              direction: "rtl",
              background: "#f2f4f3",
              border:
                "1px solid #cfd6d2",
              borderRadius: 8,
              boxShadow:
                "0 4px 12px rgba(15,23,42,0.06)",
              overflow: "visible",
            }}
          >
            {(
              Object.keys(
                filterLabels
              ) as ReturnFilterKey[]
            ).map((key) => {
              const isOpen =
                openFilter === key;

              const selected =
                filterSelections[key];

              const values =
                getUniqueFilterValues(
                  key
                ).filter((value) =>
                  value
                    .toLowerCase()
                    .includes(
                      filterSearch.toLowerCase()
                    )
                );

              return (
                <div
                  key={key}
                  style={{
                    position:
                      "relative",
                    flex: "1 1 0",
                    minWidth: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenFilter(
                        (current) =>
                          current === key
                            ? null
                            : key
                      );
                      setFilterSearch("");
                    }}
                    style={{
                      width: "100%",
                      height: 42,
                      border: "0",
                      borderLeft:
                        "1px solid #cfd6d2",
                      borderRadius: 0,
                      background:
                        selected.length
                          ? "#149b5c"
                          : "#f2f4f3",
                      color:
                        selected.length
                          ? "#fff"
                          : "#1f2937",
                      fontWeight:
                        selected.length
                          ? 800
                          : 700,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      gap: 7,
                      padding:
                        "0 10px",
                      whiteSpace:
                        "nowrap",
                      overflow:
                        "hidden",
                    }}
                  >
                    <span
                      style={{
                        overflow:
                          "hidden",
                        textOverflow:
                          "ellipsis",
                      }}
                    >
                      {selected.length
                        ? `${filterLabels[key]} (${selected.length})`
                        : filterLabels[key]}
                    </span>

                    <span
                      style={{
                        fontSize: 10,
                      }}
                    >
                      {isOpen
                        ? "▲"
                        : "▼"}
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      style={{
                        position:
                          "absolute",
                        right: 0,
                        top:
                          "calc(100% + 4px)",
                        width: 300,
                        zIndex: 10000,
                        background:
                          "#fff",
                        border:
                          "1px solid #cfd6d2",
                        borderRadius: 8,
                        boxShadow:
                          "0 14px 30px rgba(15,23,42,.14)",
                        padding: 10,
                      }}
                    >
                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "1fr 1fr",
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() =>
                            sortBy(
                              key,
                              "asc"
                            )
                          }
                        >
                          مرتب‌سازی صعودی
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() =>
                            sortBy(
                              key,
                              "desc"
                            )
                          }
                        >
                          مرتب‌سازی نزولی
                        </button>
                      </div>

                      <input
                        className="input"
                        placeholder={`جستجو در ${filterLabels[key]}...`}
                        value={
                          filterSearch
                        }
                        onChange={(e) =>
                          setFilterSearch(
                            e.target.value
                          )
                        }
                        style={{
                          marginBottom: 8,
                        }}
                      />

                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          marginBottom: 8,
                          fontSize: 12,
                          color:
                            "#64748b",
                        }}
                      >
                        <span>
                          انتخاب چند مقدار
                        </span>

                        <div
                          style={{
                            display:
                              "flex",
                            gap: 8,
                          }}
                        >
                          <button
                            type="button"
                            style={{
                              border:
                                "none",
                              background:
                                "transparent",
                              color:
                                "#0f6b43",
                              cursor:
                                "pointer",
                              fontWeight:
                                700,
                            }}
                            onClick={() =>
                              setFilterSelections(
                                (current) => ({
                                  ...current,
                                  [key]:
                                    getUniqueFilterValues(
                                      key
                                    ),
                                })
                              )
                            }
                          >
                            انتخاب همه
                          </button>

                          <button
                            type="button"
                            style={{
                              border:
                                "none",
                              background:
                                "transparent",
                              color:
                                "#dc2626",
                              cursor:
                                "pointer",
                              fontWeight:
                                700,
                            }}
                            onClick={() =>
                              setFilterSelections(
                                (current) => ({
                                  ...current,
                                  [key]: [],
                                })
                              )
                            }
                          >
                            پاک‌کردن
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          maxHeight: 240,
                          overflowY:
                            "auto",
                        }}
                      >
                        {values.map(
                          (value) => (
                            <label
                              key={value}
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: 8,
                                padding:
                                  "7px 4px",
                                cursor:
                                  "pointer",
                                borderRadius:
                                  6,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selected.includes(
                                  value
                                )}
                                onChange={() =>
                                  toggleFilterValue(
                                    key,
                                    value
                                  )
                                }
                              />

                              <span>
                                {value}
                              </span>
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={
                clearAllFilters
              }
              title="حذف همه فیلترها"
              style={{
                flex:
                  "0 0 42px",
                height: 42,
                border: "0",
                background:
                  "#dc2626",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
                fontSize: 13,
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                borderRadius: 0,
              }}
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </div>

        {/* لیست مرجوعیات */}
        <div className="panel returns-page-compact">
          {loading ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
              }}
            >
              در حال دریافت مرجوعیات...
            </div>
          ) : documents.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "#64748b",
              }}
            >
              هنوز سند مرجوعی ثبت نشده است.
            </div>
          ) : (
            <DataTable
              data={filteredRows}
              columns={tableColumns}
              rowKey={(row) => row.id}
              pageSize={0}
              emptyText="مرجوعی پیدا نشد."
            />
          )}
        </div>
      </AppShell>
    </>
  );
}
