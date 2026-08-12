"use client";

import { useMemo, useState } from "react";

type ColumnFilterProps = {
  title: string;
  values: Array<string | number | null | undefined>;
  selectedValues: string[];
  onApply: (values: string[]) => void;
  formatValue?: (value: string) => string;
};

function normalize(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "خالی";
  return String(value);
}

export default function ColumnFilter({
  title,
  values,
  selectedValues,
  onApply,
  formatValue,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string[]>(selectedValues);

  const uniqueValues = useMemo(() => {
    const map = new Map<string, string>();

    values.forEach((value) => {
      const raw = normalize(value);
      if (!map.has(raw)) {
        map.set(raw, formatValue ? formatValue(raw) : raw);
      }
    });

    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "fa")
    );
  }, [values, formatValue]);

  const visibleValues = uniqueValues.filter(([, label]) =>
    label.toLowerCase().includes(search.trim().toLowerCase())
  );

  function toggleValue(value: string) {
    setDraft((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value]
    );
  }

  function selectAll() {
    setDraft(uniqueValues.map(([value]) => value));
  }

  function clearDraft() {
    setDraft([]);
  }

  function apply() {
    onApply(draft);
    setOpen(false);
  }

  function clearFilter() {
    onApply([]);
    setDraft([]);
    setSearch("");
    setOpen(false);
  }

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        direction: "rtl",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        title={`فیلتر ${title}`}
        onClick={() => {
          setDraft(selectedValues);
          setSearch("");
          setOpen((previous) => !previous);
        }}
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          border: selectedValues.length
            ? "2px solid #4f46e5"
            : "1px solid #cbd5e1",
          background: selectedValues.length ? "#eef2ff" : "#fff",
          color: "#475569",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          fontWeight: 800,
        }}
      >
        ▼
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 5000,
            width: 310,
            maxWidth: "min(310px, 90vw)",
            background: "#fff",
            border: "1px solid #cbd5e1",
            borderRadius: 14,
            boxShadow: "0 18px 45px rgba(15,23,42,.18)",
            padding: 14,
            direction: "rtl",
          }}
        >
          <div
            style={{
              fontWeight: 900,
              fontSize: 16,
              marginBottom: 10,
            }}
          >
            فیلتر {title}
          </div>

          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو در مقادیر..."
            style={{ width: "100%", marginBottom: 10 }}
            autoFocus
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <button
              type="button"
              onClick={selectAll}
              style={{
                border: 0,
                background: "transparent",
                color: "#4f46e5",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              انتخاب همه
            </button>

            <button
              type="button"
              onClick={clearDraft}
              style={{
                border: 0,
                background: "transparent",
                color: "#64748b",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              پاک کردن
            </button>
          </div>

          <div
            style={{
              maxHeight: 260,
              overflowY: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 6,
            }}
          >
            {visibleValues.length === 0 ? (
              <div
                style={{
                  padding: 18,
                  textAlign: "center",
                  color: "#64748b",
                }}
              >
                مقداری پیدا نشد.
              </div>
            ) : (
              visibleValues.map(([value, label]) => (
                <label
                  key={value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "8px 7px",
                    borderRadius: 7,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draft.includes(value)}
                    onChange={() => toggleValue(value)}
                  />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={label}
                  >
                    {label}
                  </span>
                </label>
              ))
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 10,
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={apply}
              style={{ flex: 1 }}
            >
              اعمال
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearFilter}
              style={{ flex: 1 }}
            >
              پاک کردن فیلتر
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
