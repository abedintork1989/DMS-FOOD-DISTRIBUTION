"use client";

import {
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import styles from "./DataTable.module.css";

export type DataTableColumn<T> = {
  key: string;
  title: string;
  width?: number | string;
  filterable?: boolean;
  searchable?: boolean;
  sortable?: boolean;
  type?: "text" | "number";
  accessor: (row: T) => unknown;
  render?: (value: unknown, row: T) => ReactNode;
};

type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T, index: number) => string | number;
  pageSize?: number;
  emptyText?: string;
  rowClassName?: (row: T) => string;
};

type SortState = {
  key: string;
  direction: "asc" | "desc";
} | null;

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().toLowerCase();
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function compareValues(
  a: unknown,
  b: unknown,
  type: "text" | "number" = "text"
) {
  if (type === "number") {
    const numberA = Number(a ?? 0);
    const numberB = Number(b ?? 0);

    if (numberA < numberB) return -1;
    if (numberA > numberB) return 1;
    return 0;
  }

  return String(a ?? "").localeCompare(
    String(b ?? ""),
    "fa",
    {
      numeric: true,
      sensitivity: "base",
    }
  );
}

export default function DataTable<T>({
  data,
  columns,
  rowKey,
  pageSize = 0,
  emptyText = "موردی پیدا نشد.",
  rowClassName,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);

  /*
   * فیلترهایی که قبلاً روی جدول اعمال شده‌اند.
   * key = کلید ستون
   * value = مقادیر انتخاب‌شده همان ستون
   */
  const [appliedFilters, setAppliedFilters] = useState<
    Record<string, string[]>
  >({});

  const [openFilterKey, setOpenFilterKey] =
    useState<string | null>(null);

  const [draftFilterValues, setDraftFilterValues] =
    useState<string[]>([]);

  const [filterSearch, setFilterSearch] =
    useState("");

  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  const [currentPage, setCurrentPage] = useState(1);

  /*
   * وقتی روی بیرون پنجره فیلتر کلیک شود، پنجره بسته می‌شود.
   */
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!filterMenuRef.current) return;

      if (
        !filterMenuRef.current.contains(
          event.target as Node
        )
      ) {
        setOpenFilterKey(null);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  /*
   * وقتی فیلترها تغییر می‌کنند، به صفحه اول برگرد.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, sort]);

  /*
   * مقادیر یونیک هر ستون.
   *
   * مهم:
   * اینجا مقدارها به صورت عمودی مرتب می‌شوند
   * و در منوی فیلتر زیر هم نمایش داده خواهند شد.
   */
  const uniqueValuesByColumn = useMemo(() => {
    const result: Record<string, string[]> = {};

    for (const column of columns) {
      if (!column.filterable) continue;

      const uniqueMap = new Map<string, string>();

      for (const row of data) {
        const rawValue = column.accessor(row);
        const value = displayValue(rawValue);
        const normalized = normalizeText(value);

        if (!uniqueMap.has(normalized)) {
          uniqueMap.set(normalized, value);
        }
      }

      result[column.key] = Array.from(
        uniqueMap.values()
      ).sort((a, b) =>
        a.localeCompare(b, "fa", {
          numeric: true,
          sensitivity: "base",
        })
      );
    }

    return result;
  }, [columns, data]);

  /*
   * باز کردن فیلتر یک ستون.
   */
  function openFilter(column: DataTableColumn<T>) {
    const current =
      appliedFilters[column.key] || [];

    setDraftFilterValues([...current]);
    setFilterSearch("");
    setOpenFilterKey(column.key);
  }

  /*
   * انتخاب / حذف یک مقدار از فیلتر.
   */
  function toggleFilterValue(value: string) {
    setDraftFilterValues((previous) => {
      if (previous.includes(value)) {
        return previous.filter(
          (item) => item !== value
        );
      }

      return [...previous, value];
    });
  }

  /*
   * انتخاب همه مقادیر.
   */
  function selectAllFilterValues(
    column: DataTableColumn<T>
  ) {
    const values =
      uniqueValuesByColumn[column.key] || [];

    setDraftFilterValues(values);
  }

  /*
   * پاک کردن فیلتر فعلی ستون.
   */
  function clearColumnFilter(
    column: DataTableColumn<T>
  ) {
    setAppliedFilters((previous) => {
      const next = { ...previous };
      delete next[column.key];
      return next;
    });

    setDraftFilterValues([]);
    setFilterSearch("");
    setOpenFilterKey(null);
  }

  /*
   * اعمال فیلتر ستون.
   */
  function applyColumnFilter(
    column: DataTableColumn<T>
  ) {
    setAppliedFilters((previous) => {
      const next = { ...previous };

      if (draftFilterValues.length === 0) {
        delete next[column.key];
      } else {
        next[column.key] = [
          ...draftFilterValues,
        ];
      }

      return next;
    });

    setOpenFilterKey(null);
  }

  /*
   * حذف تمام فیلترهای جدول.
   */
  function clearAllFilters() {
    setAppliedFilters({});
    setOpenFilterKey(null);
    setDraftFilterValues([]);
    setFilterSearch("");
    setCurrentPage(1);
  }

  /*
   * مرتب‌سازی.
   */
  function toggleSort(
    column: DataTableColumn<T>
  ) {
    if (!column.sortable) return;

    setSort((previous) => {
      if (!previous || previous.key !== column.key) {
        return {
          key: column.key,
          direction: "asc",
        };
      }

      if (previous.direction === "asc") {
        return {
          key: column.key,
          direction: "desc",
        };
      }

      return null;
    });
  }

  /*
   * اعمال فیلترهای فعال.
   */
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      return columns.every((column) => {
        const selected =
          appliedFilters[column.key];

        if (
          !column.filterable ||
          !selected ||
          selected.length === 0
        ) {
          return true;
        }

        const rowValue = displayValue(
          column.accessor(row)
        );

        return selected.some(
          (selectedValue) =>
            normalizeText(selectedValue) ===
            normalizeText(rowValue)
        );
      });
    });
  }, [data, columns, appliedFilters]);

  /*
   * مرتب‌سازی داده‌های فیلترشده.
   */
  const sortedData = useMemo(() => {
    if (!sort) return filteredData;

    const column = columns.find(
      (item) => item.key === sort.key
    );

    if (!column) return filteredData;

    return [...filteredData].sort((rowA, rowB) => {
      const result = compareValues(
        column.accessor(rowA),
        column.accessor(rowB),
        column.type || "text"
      );

      return sort.direction === "asc"
        ? result
        : -result;
    });
  }, [filteredData, columns, sort]);

  /*
   * صفحه‌بندی.
   * pageSize = 0 یعنی همه ردیف‌ها نمایش داده شوند.
   */
  const totalPages =
    pageSize > 0
      ? Math.max(
          1,
          Math.ceil(
            sortedData.length / pageSize
          )
        )
      : 1;

  const visibleData = useMemo(() => {
    if (pageSize <= 0) {
      return sortedData;
    }

    const start =
      (currentPage - 1) * pageSize;

    return sortedData.slice(
      start,
      start + pageSize
    );
  }, [
    sortedData,
    pageSize,
    currentPage,
  ]);

  /*
   * اگر بعد از فیلتر تعداد صفحات کمتر شد،
   * صفحه فعلی را اصلاح کن.
   */
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const activeFilterCount =
    Object.values(appliedFilters).filter(
      (values) => values.length > 0
    ).length;

  const activeColumnValues =
    openFilterKey
      ? uniqueValuesByColumn[
          openFilterKey
        ] || []
      : [];

  const filteredUniqueValues =
    activeColumnValues.filter((value) =>
      normalizeText(value).includes(
        normalizeText(filterSearch)
      )
    );

  return (
    <div className={styles["data-table-container"]}>
      <div
        className={
          styles["data-table-toolbar"]
        }
      >
        <div
          className={
            styles["data-table-result-count"]
          }
        >
          نمایش{" "}
          <strong>
            {visibleData.length}
          </strong>{" "}
          از{" "}
          <strong>
            {sortedData.length}
          </strong>{" "}
          رکورد
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            className={
              styles["data-table-clear-all"]
            }
            onClick={clearAllFilters}
          >
            پاک کردن همه فیلترها
          </button>
        )}
      </div>

      <div
        className={
          styles["data-table-scroll"]
        }
      >
        <table
          className={
            styles["data-table"]
          }
        >
          <thead>
            <tr>
              {columns.map((column) => {
                const isActive =
                  !!appliedFilters[
                    column.key
                  ]?.length;

                const isOpen =
                  openFilterKey ===
                  column.key;

                return (
                  <th
                    key={column.key}
                    style={{
                      width: column.width,
                      minWidth: undefined,
                    }}
                  >
                    <div
                      className={
                        styles[
                          "data-table-header"
                        ]
                      }
                    >
                      <button
                        type="button"
                        className={
                          styles[
                            "data-table-header-title"
                          ]
                        }
                        onClick={() =>
                          toggleSort(column)
                        }
                        disabled={
                          !column.sortable
                        }
                      >
                        <span>
                          {column.title}
                        </span>

                        {column.sortable && (
                          <span
                            className={
                              styles[
                                "data-table-sort-icon"
                              ]
                            }
                          >
                            {sort?.key ===
                            column.key
                              ? sort.direction ===
                                "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        )}
                      </button>

                      {column.filterable && (
                        <button
                          type="button"
                          className={`${styles["data-table-filter-button"]} ${
                            isActive
                              ? styles.active
                              : ""
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();

                            if (isOpen) {
                              setOpenFilterKey(
                                null
                              );
                            } else {
                              openFilter(column);
                            }
                          }}
                          title={`فیلتر ${column.title}`}
                        >
                          ▼
                        </button>
                      )}

                      {isOpen && (
                        <div
                          ref={filterMenuRef}
                          className={
                            styles[
                              "data-table-filter-menu"
                            ]
                          }
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                        >
                          <div
                            className={
                              styles[
                                "data-table-filter-title"
                              ]
                            }
                          >
                            فیلتر{" "}
                            {column.title}
                          </div>

                          {column.searchable !==
                            false && (
                            <input
                              className={
                                styles[
                                  "data-table-filter-input"
                                ]
                              }
                              value={
                                filterSearch
                              }
                              onChange={(event) =>
                                setFilterSearch(
                                  event.target
                                    .value
                                )
                              }
                              placeholder="جستجو در مقادیر..."
                            />
                          )}

                          <div
                            style={{
                              marginTop: 10,
                              maxHeight: 220,
                              overflowY: "auto",
                              overflowX: "hidden",
                              display: "flex",
                              flexDirection:
                                "column",
                              gap: 2,
                              padding:
                                "2px 0",
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems:
                                  "center",
                                gap: 8,
                                width: "100%",
                                minHeight: 32,
                                cursor:
                                  "pointer",
                                padding:
                                  "4px 6px",
                                boxSizing:
                                  "border-box",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  activeColumnValues.length >
                                    0 &&
                                  draftFilterValues.length ===
                                    activeColumnValues.length
                                }
                                onChange={() => {
                                  if (
                                    draftFilterValues.length ===
                                    activeColumnValues.length
                                  ) {
                                    setDraftFilterValues(
                                      []
                                    );
                                  } else {
                                    selectAllFilterValues(
                                      column
                                    );
                                  }
                                }}
                              />
                              <span>
                                همه
                              </span>
                            </label>

                            {filteredUniqueValues.map(
                              (value) => (
                                <label
                                  key={value}
                                  style={{
                                    display:
                                      "flex",
                                    alignItems:
                                      "center",
                                    gap: 8,
                                    width:
                                      "100%",
                                    minHeight: 32,
                                    cursor:
                                      "pointer",
                                    padding:
                                      "4px 6px",
                                    boxSizing:
                                      "border-box",
                                    fontSize: 12,
                                    lineHeight:
                                      1.5,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={draftFilterValues.includes(
                                      value
                                    )}
                                    onChange={() =>
                                      toggleFilterValue(
                                        value
                                      )
                                    }
                                  />

                                  <span
                                    style={{
                                      overflow:
                                        "hidden",
                                      textOverflow:
                                        "ellipsis",
                                      whiteSpace:
                                        "nowrap",
                                      flex: 1,
                                    }}
                                    title={
                                      value
                                    }
                                  >
                                    {value}
                                  </span>
                                </label>
                              )
                            )}

                            {filteredUniqueValues.length ===
                              0 && (
                              <div
                                style={{
                                  padding:
                                    "12px 6px",
                                  color:
                                    "#64748b",
                                  fontSize:
                                    12,
                                  textAlign:
                                    "center",
                                }}
                              >
                                مقداری پیدا نشد.
                              </div>
                            )}
                          </div>

                          <div
                            className={
                              styles[
                                "data-table-filter-actions"
                              ]
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                clearColumnFilter(
                                  column
                                )
                              }
                            >
                              پاک کردن
                            </button>

                            <button
                              type="button"
                              className={
                                styles.primary
                              }
                              onClick={() =>
                                applyColumnFilter(
                                  column
                                )
                              }
                            >
                              اعمال
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {visibleData.map(
              (row, rowIndex) => (
                <tr
                  key={rowKey(
                    row,
                    rowIndex
                  )}
                  className={
                    rowClassName
                      ? rowClassName(row)
                      : undefined
                  }
                >
                  {columns.map((column) => {
                    const value =
                      column.accessor(row);

                    return (
                      <td
                        key={column.key}
                        style={{
                          width:
                            column.width,
                          minWidth:
                            column.width,
                        }}
                      >
                        {column.render
                          ? column.render(
                              value,
                              row
                            )
                          : displayValue(
                              value
                            )}
                      </td>
                    );
                  })}
                </tr>
              )
            )}

            {visibleData.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className={
                    styles[
                      "data-table-empty"
                    ]
                  }
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageSize > 0 &&
        totalPages > 1 && (
          <div
            className={
              styles[
                "data-table-pagination"
              ]
            }
          >
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() =>
                setCurrentPage(
                  (page) =>
                    Math.max(1, page - 1)
                )
              }
            >
              قبلی
            </button>

            <span>
              صفحه{" "}
              <strong>
                {currentPage}
              </strong>{" "}
              از{" "}
              <strong>
                {totalPages}
              </strong>
            </span>

            <button
              type="button"
              disabled={
                currentPage >= totalPages
              }
              onClick={() =>
                setCurrentPage(
                  (page) =>
                    Math.min(
                      totalPages,
                      page + 1
                    )
                )
              }
            >
              بعدی
            </button>
          </div>
        )}
    </div>
  );
}
