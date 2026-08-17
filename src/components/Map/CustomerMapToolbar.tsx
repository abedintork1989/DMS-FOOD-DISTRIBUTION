import { useState } from "react";
import { ChevronDown, X } from "lucide-react";

type HeaderItem = {
  id: string;
  title: string;
  items: string[];
};

const HEADERS: HeaderItem[] = [
  {
    id: "customers",
    title: "مشتریان",
    items: [
      "مشتریان زنجیره‌ای",
      "مشتریان VIP",
      "مشتریان مویرگی",
      "مشتریان فعال",
      "مشتریان غیرفعال",
      "مشتریان خرید اولی",
      "مشتریان دائمی",
      "مشتریان از دست‌رفته",
      "مشتریان در خطر ریزش",
    ],
  },
  {
    id: "visitors",
    title: "ویزیتورها / نیروی فروش",
    items: [
      "درصد ویزیت منجر به سفارش",
      "فروش به ازای هر ویزیت",
      "پوشش مشتریان",
      "نرخ تبدیل ویزیت به سفارش",
      "میزان تحقق هدف فروش",
    ],
  },
  {
    id: "sales",
    title: "فروش و سفارشات",
    items: [
      "فروش خالص",
      "رشد فروش",
      "حاشیه سود",
      "میانگین مبلغ سفارش",
      "میزان تحقق هدف فروش",
    ],
  },
  {
    id: "products",
    title: "محصولات و سبد کالا",
    items: [
      "سرعت فروش کالا",
      "سودآوری کالا و گروه کالا",
      "میزان نفوذ هر کالا در مشتریان",
      "عمق سبد خرید مشتری",
      "نرخ نبود کالا",
    ],
  },
  {
    id: "finance",
    title: "مالی و وصول مطالبات",
    items: [
      "میانگین مدت وصول مطالبات",
      "درصد مطالبات معوق",
      "نرخ وصول مطالبات",
      "میزان استفاده از اعتبار مشتری",
      "میزان مطالبات سوخت‌شده",
    ],
  },
  {
    id: "distribution",
    title: "توزیع، مسیر و پوشش بازار",
    items: [
      "پوشش عددی بازار",
      "پوشش وزنی بازار",
      "پوشش مشتریان هدف",
      "بهره‌وری مسیرهای ویزیت",
      "هزینه خدمت‌رسانی به مشتری",
    ],
  },
  {
    id: "market",
    title: "بازار و توسعه",
    items: [
      "میزان نفوذ در بازار",
      "جذب مشتری جدید",
      "پوشش بازار بالقوه",
      "ظرفیت‌های استفاده‌نشده بازار",
      "فاصله فروش فعلی با ظرفیت بازار",
    ],
  },
];

export default function CustomerMapToolbar({
  visitors: _visitors,
}: {
  visitors?: { id: string; full_name: string }[];
}) {
  const [openHeaders, setOpenHeaders] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  function toggleHeader(id: string) {
    setOpenHeaders((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleItem(headerId: string, item: string) {
    const key = `${headerId}::${item}`;

    setSelectedItems((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  function clearFilters() {
    setOpenHeaders(new Set());
    setSelectedItems(new Set());
  }

  const openHeaderList = HEADERS.filter((header) => openHeaders.has(header.id));

  return (
    <div
      dir="rtl"
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        position: "relative",
        zIndex: 9999,
        marginBottom: 4,
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "stretch",
          direction: "rtl",
        }}
      >
        {/* منوی اصلی + زیرمنوهای فعال */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* سربرگ‌های اصلی */}
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              width: "100%",
              border: "1px solid #d8e4dc",
              borderRadius: openHeaderList.length > 0 ? "9px 9px 0 0" : 9,
              overflow: "visible",
              background: "#f8faf9",
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
            }}
          >
            {HEADERS.map((header, index) => {
              const isOpen = openHeaders.has(header.id);

              return (
                <div
                  key={header.id}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleHeader(header.id)}
                    style={{
                      height: 48,
                      width: "100%",
                      padding: "0 14px",
                      border: "none",
                      borderLeft:
                        index === HEADERS.length - 1
                          ? "none"
                          : "1px solid #dfe8e2",
                      background: isOpen ? "#0f6b43" : "#f8faf9",
                      color: isOpen ? "#ffffff" : "#111827",
                      fontSize: 11.5,
                      fontWeight: isOpen ? 800 : 700,
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      transition: "background 140ms ease, color 140ms ease",
                      fontFamily: "inherit",
                    }}
                  >
                    <span>{header.title}</span>
                    <ChevronDown
                      size={11}
                      strokeWidth={2.5}
                      style={{
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 140ms ease",
                        flexShrink: 0,
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* هر سربرگ فعال، زیرمنوی افقی خودش را در یک ردیف جدا نشان می‌دهد */}
          {openHeaderList.map((header) => (
            <div
              key={header.id}
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                background: "#eaf6ef",
                borderLeft: "1px solid #cfe6d8",
                borderRight: "1px solid #cfe6d8",
                borderBottom: "1px solid #cfe6d8",
                padding: 4,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  width: "100%",
                  borderBottom:
                    header.items.length > 0 ? "1px solid #d5eadc" : "none",
                }}
              >
                {header.items.map((item, index) => {
                  const key = `${header.id}::${item}`;
                  const selected = selectedItems.has(key);

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleItem(header.id, item)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: 34,
                        padding: "5px 9px",
                        border: "none",
                        borderLeft:
                          index === header.items.length - 1
                            ? "none"
                            : "1px solid #d4eadc",
                        background: selected ? "#0f6b43" : "transparent",
                        color: selected ? "#ffffff" : "#1f5138",
                        textAlign: "center",
                        fontSize: selected ? 10.8 : 10,
                        fontWeight: selected ? 800 : 600,
                        lineHeight: 1.35,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        whiteSpace: "normal",
                        transition:
                          "background 120ms ease, color 120ms ease, font-size 120ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!selected) {
                          e.currentTarget.style.background = "#d7edde";
                          e.currentTarget.style.color = "#0f6b43";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selected) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "#1f5138";
                        }
                      }}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* دکمه حذف فیلترها در انتهای نوار اصلی */}
        <button
          type="button"
          onClick={clearFilters}
          title="حذف فیلترها و بستن همه زیرمنوها"
          style={{
            width: 92,
            flexShrink: 0,
            marginRight: 4,
            border: "1px solid #b91c1c",
            borderRadius: 9,
            background: "#dc2626",
            color: "#ffffff",
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "inherit",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(220, 38, 38, 0.16)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          <X size={12} strokeWidth={2.8} />
          <span>حذف فیلتر</span>
        </button>
      </div>
    </div>
  );
}
