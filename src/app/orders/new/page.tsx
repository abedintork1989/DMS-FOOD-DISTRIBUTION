"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { ArrowRight, Search, ShoppingCart } from "lucide-react";

/* ================================================== */
/* تبدیل تاریخ شمسی <-> میلادی (بدون نیاز به کتابخانه) */
/* ================================================== */

function gregorianToJalali(gy: number, gm: number, gd: number) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy;

  if (gy > 1600) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }

  const gy2 = gm > 2 ? gy + 1 : gy;

  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];

  jy += 33 * Math.floor(days / 12053);
  days %= 12053;

  jy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);

  return { jy, jm, jd };
}

function jalaliToGregorian(jy: number, jm: number, jd: number) {
  let gy;

  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }

  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  gy += 400 * Math.floor(days / 146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }

  gy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  let gd = days + 1;

  const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const sal_a = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  let gm = 1;
  for (gm = 1; gm <= 12; gm++) {
    if (gd <= sal_a[gm]) break;
    gd -= sal_a[gm];
  }

  return { gy, gm, gd };
}

const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

function jalaliDaysInMonth(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // اسفند: در اکثر سال‌ها ۲۹ روز، در سال‌های کبیسه ۳۰ روز است
  const isLeap =
    ((((jy - (jy > 0 ? 474 : 473)) % 2820) + 474 + 38) * 682) % 2816 < 682;
  return isLeap ? 30 : 29;
}

/* ================================================== */
/* ابزارهای عدد فارسی */
/* ================================================== */

function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function digitsOnly(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^\d]/g, "");
}

function formatNumber(value: number | string | null | undefined) {
  const digits = digitsOnly(String(value ?? ""));
  if (!digits) return "۰";
  return toPersianDigits(digits.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
}

function money(value: number | string | null | undefined) {
  return `${formatNumber(value)} ریال`;
}

// برای مقایسه‌ی درست دو رشته‌ی فارسی (مثل نام گروه کالا)، چون معمولاً
// اختلاف در نویسه‌های عربی/فارسی (ی/ي ، ک/ك)، نیم‌فاصله یا فاصله‌ی
// اضافی باعث می‌شه دو متن که ظاهراً یکی هستن، برابر تشخیص داده نشن.
function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/[\u200c\u200f\u200e]/g, "")
    .replace(/[\s\-_]+/g, "")
    .trim()
    .toLowerCase();
}

/* ================================================== */
/* تایپ‌ها */
/* ================================================== */

type Customer = {
  id: string;
  name: string;
  visitor?: string | null;
};

type Product = {
  id: string;
  name: string;
  barcode?: string | null;
  category?: string | null;
  image_url?: string | null;
  quantity_per_carton?: number | null;
  consumer_price?: number | null;
};

type CustomerDiscount = {
  category: string;
  discount_percent: number;
};

/* ================================================== */
/* صفحه */
/* ================================================== */

export default function NewOrderPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<CustomerDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [visitor, setVisitor] = useState("");

  // تاریخ ارسال (شمسی) - پیش‌فرض: امروز
  const todayJalali = useMemo(() => {
    const now = new Date();
    return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }, []);

  const [shipYear, setShipYear] = useState<number>(todayJalali.jy);
  const [shipMonth, setShipMonth] = useState<number>(todayJalali.jm);
  const [shipDay, setShipDay] = useState<number>(todayJalali.jd);

  // ناوبری داخل صفحه: لیست گروه‌های کالا یا داخل یک گروه خاص
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // فقط تعداد کارتن قابل ورود است؛ تعداد جزء همیشه از روی آن محاسبه می‌شود.
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    try {
      await Promise.all([loadCustomers(), loadProducts()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("id,name,visitor")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      alert(`خطا در دریافت مشتریان: ${error.message}`);
      return;
    }

    setCustomers((data || []) as Customer[]);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select(
        `id, name, barcode, category, image_url, quantity_per_carton, consumer_price`
      )
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      alert(`خطا در دریافت کالاها: ${error.message}`);
      return;
    }

    setProducts((data || []) as Product[]);
  }

  async function loadCustomerDiscounts(id: string) {
    if (!id) {
      setDiscounts([]);
      return;
    }

    const { data, error } = await supabase
      .from("customer_group_discounts")
      .select("category,discount_percent")
      .eq("customer_id", id);

    if (error) {
      console.error(error);
      setDiscounts([]);
      return;
    }

    setDiscounts((data || []) as CustomerDiscount[]);
  }

  async function handleCustomerChange(id: string) {
    setCustomerId(id);
    const customer = customers.find((item) => item.id === id);
    setVisitor(customer?.visitor || "");
    await loadCustomerDiscounts(id);
  }

  function getDiscountForCategory(category: string | null | undefined) {
    if (!category) return 0;
    const target = normalizeText(category);
    const item = discounts.find(
      (discount) => normalizeText(discount.category) === target
    );
    return Number(item?.discount_percent || 0);
  }

  function getFinalPrice(product: Product) {
    const consumerPrice = Number(product.consumer_price || 0);
    const discountPercent = getDiscountForCategory(product.category);
    return Math.round(consumerPrice - (consumerPrice * discountPercent) / 100);
  }

  function getCartons(productId: string) {
    return quantities[productId] || "";
  }

  function updateCartons(productId: string, value: string) {
    const clean = digitsOnly(value);
    setQuantities((previous) => ({
      ...previous,
      [productId]: clean,
    }));
  }

  /* ================================================== */
  /* محاسبه‌ی آیتم‌های سفارش (روی همه‌ی گروه‌ها، نه فقط گروه فعال) */
  /* ================================================== */

  const orderItems = useMemo(() => {
    const result: {
      productId: string;
      category: string;
      cartons: number;
      totalUnits: number;
      consumerPrice: number;
      discountPercent: number;
      finalPrice: number;
      total: number;
    }[] = [];

    for (const product of products) {
      const cartons = Number(getCartons(product.id) || 0);

      if (cartons === 0) continue;

      const cartonSize = Math.max(Number(product.quantity_per_carton || 1), 1);
      const totalUnits = cartons * cartonSize;

      const consumerPrice = Number(product.consumer_price || 0);
      const discountPercent = getDiscountForCategory(product.category);
      const finalPrice = getFinalPrice(product);

      result.push({
        productId: product.id,
        category: product.category || "بدون گروه",
        cartons,
        totalUnits,
        consumerPrice,
        discountPercent,
        finalPrice,
        total: totalUnits * finalPrice,
      });
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, quantities, discounts]);

  const orderTotal = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.total, 0),
    [orderItems]
  );

  const totalCartons = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.cartons, 0),
    [orderItems]
  );

  /* ================================================== */
  /* گروه‌بندی کالاها */
  /* ================================================== */

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category || "بدون گروه"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fa"));
  }, [products]);

  const itemCountByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    orderItems.forEach((item) => {
      map[item.category] = (map[item.category] || 0) + 1;
    });
    return map;
  }, [orderItems]);

  const productsInCategory = useMemo(() => {
    if (!activeCategory) return [];
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if ((p.category || "بدون گروه") !== activeCategory) return false;
      if (!q) return true;
      return [p.name, p.barcode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [products, activeCategory, search]);

  /* ================================================== */
  /* ثبت سفارش */
  /* ================================================== */

  async function submitOrder() {
    if (!customerId) {
      alert("لطفاً مشتری را انتخاب کنید.");
      return;
    }

    if (orderItems.length === 0) {
      alert("حداقل یک کالا برای سفارش انتخاب کنید.");
      return;
    }

    const { gy, gm, gd } = jalaliToGregorian(shipYear, shipMonth, shipDay);
    const deliveryDate = `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(
      2,
      "0"
    )}`;

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        alert("ابتدا باید وارد حساب کاربری خود شوید.");
        setSaving(false);
        return;
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: customerId,
          status: "pending",
          invoice_total: orderTotal,
          delivery_date: deliveryDate,
        })
        .select("*")
        .single();

      if (orderError || !order) {
        console.error(orderError);
        alert(`خطا در ثبت سفارش: ${orderError?.message || "نامشخص"}`);
        setSaving(false);
        return;
      }

      const itemsPayload = orderItems.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.totalUnits,
        consumer_price: item.consumerPrice,
        discount_percent: item.discountPercent,
        purchase_price: item.finalPrice,
        final_price: item.finalPrice,
        total_purchase_price: item.total,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(itemsPayload);

      if (itemsError) {
        console.error(itemsError);
        await supabase.from("orders").delete().eq("id", order.id);
        alert(`خطا در ثبت کالاهای سفارش: ${itemsError.message}`);
        setSaving(false);
        return;
      }

      alert("سفارش با موفقیت ثبت شد.");
      router.push("/orders");
    } catch (error) {
      console.error(error);
      alert("خطایی هنگام ثبت سفارش رخ داد.");
    } finally {
      setSaving(false);
    }
  }

  /* ================================================== */
  /* Render */
  /* ================================================== */

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="ثبت سفارش جدید" subtitle="در حال آماده‌سازی..." />
        <div style={{ padding: 40, textAlign: "center" }}>در حال بارگذاری...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="ثبت سفارش جدید"
        subtitle="مشتری، تاریخ ارسال و کالاها را مشخص کنید"
        action={
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/orders")}
          >
            بازگشت به لیست سفارشات
          </button>
        }
      />

      {/* اطلاعات سفارش */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <div className="form-field">
            <label>مشتری</label>
            <select
              className="input"
              value={customerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
            >
              <option value="">انتخاب مشتری</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>ویزیتور</label>
            <input
              className="input"
              value={visitor}
              onChange={(e) => setVisitor(e.target.value)}
              placeholder="نام ویزیتور"
            />
          </div>

          <div className="form-field">
            <label>تاریخ ارسال</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                className="input"
                value={shipDay}
                onChange={(e) => setShipDay(Number(e.target.value))}
              >
                {Array.from(
                  { length: jalaliDaysInMonth(shipYear, shipMonth) },
                  (_, i) => i + 1
                ).map((day) => (
                  <option key={day} value={day}>
                    {toPersianDigits(day)}
                  </option>
                ))}
              </select>

              <select
                className="input"
                value={shipMonth}
                onChange={(e) => setShipMonth(Number(e.target.value))}
              >
                {JALALI_MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                className="input"
                value={shipYear}
                onChange={(e) => setShipYear(Number(e.target.value))}
              >
                {Array.from({ length: 4 }, (_, i) => todayJalali.jy + i - 1).map(
                  (year) => (
                    <option key={year} value={year}>
                      {toPersianDigits(year)}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              padding: 15,
              borderRadius: 12,
              background: "#eef2ff",
              border: "1px solid #c7d2fe",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 13, color: "#4338ca", fontWeight: 700 }}>
              تعداد کل کارتن
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#3730a3" }}>
              {toPersianDigits(totalCartons)}
            </div>
          </div>

          <div
            style={{
              padding: 15,
              borderRadius: 12,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 13, color: "#047857", fontWeight: 700 }}>
              مبلغ کل فاکتور
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#065f46" }}>
              {money(orderTotal)}
            </div>
          </div>

          <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submitOrder}
              disabled={saving}
            >
              {saving ? "در حال ثبت..." : "✅ ثبت سفارش"}
            </button>
          </div>
        </div>

        {customerId && (
          <div
            style={{
              marginTop: 16,
              padding: 15,
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 10 }}>تخفیف‌های مشتری</div>
            {discounts.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>
                برای این مشتری تخفیف گروهی ثبت نشده است؛ همه‌ی کالاها با تخفیف ۰٪
                محاسبه می‌شوند.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {discounts.map((discount) => (
                  <span
                    key={discount.category}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      fontSize: 13,
                    }}
                  >
                    {discount.category}:{" "}
                    <strong>{toPersianDigits(discount.discount_percent)}٪</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* گروه‌های کالا یا جدول کالاهای یک گروه */}
      <div className="panel" style={{ marginBottom: 100 }}>
        {!activeCategory ? (
          <>
            <h3 style={{ marginTop: 0 }}>گروه کالاها</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 14,
              }}
            >
              {categories.map((category) => {
                const count = itemCountByCategory[category] || 0;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setActiveCategory(category);
                      setSearch("");
                    }}
                    style={{
                      position: "relative",
                      padding: "24px 16px",
                      borderRadius: 14,
                      border: count ? "2px solid #4f46e5" : "1px solid #e2e8f0",
                      background: count ? "#eef2ff" : "#fff",
                      cursor: "pointer",
                      textAlign: "center",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {category}
                    {count > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          top: -8,
                          left: -8,
                          background: "#4f46e5",
                          color: "#fff",
                          borderRadius: "999px",
                          minWidth: 24,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {toPersianDigits(count)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 15,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveCategory(null)}
              >
                <ArrowRight size={16} />
                بازگشت به گروه‌ها
              </button>

              <h3 style={{ margin: 0 }}>{activeCategory}</h3>
            </div>

            <div style={{ marginBottom: 15, position: "relative" }}>
              <Search
                size={17}
                style={{ position: "absolute", right: 12, top: 13, color: "#94a3b8" }}
              />
              <input
                className="input"
                style={{ paddingRight: 40 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی نام یا بارکد کالا..."
              />
            </div>

            <div
              className="table-wrap"
              style={{
                width: "100%",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <table
                style={{
                  width: "100%",
                  tableLayout: "fixed",
                  fontSize: 10,
                  borderCollapse: "collapse",
                }}
              >
                <colgroup>
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "13%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ padding: "3px 3px" }}>عکس</th>
                    <th style={{ padding: "3px 3px" }}>بارکد</th>
                    <th style={{ padding: "3px 3px" }}>نام کالا</th>
                    <th style={{ padding: "3px 3px" }}>تعداد در کارتن</th>
                    <th style={{ padding: "3px 3px" }}>سفارش به کارتن</th>
                    <th style={{ padding: "3px 3px" }}>سفارش به جزء</th>
                    <th style={{ padding: "3px 3px" }}>قیمت مصرف‌کننده</th>
                    <th style={{ padding: "3px 3px" }}>تخفیف</th>
                    <th style={{ padding: "3px 3px" }}>قیمت نهایی</th>
                    <th style={{ padding: "3px 3px" }}>جمع پرداختی</th>
                  </tr>
                </thead>
                <tbody>
                  {productsInCategory.map((product) => {
                    const cartonsValue = getCartons(product.id);
                    const cartonSize = Math.max(
                      Number(product.quantity_per_carton || 1),
                      1
                    );
                    const discount = getDiscountForCategory(product.category);
                    const finalPrice = getFinalPrice(product);
                    const cartons = Number(cartonsValue || 0);
                    // سفارش به جزء همیشه فقط نمایش داده می‌شود؛
                    // مقدارش خودکار از «سفارش به کارتن» × «تعداد در کارتن» به‌دست می‌آید.
                    const totalUnits = cartons * cartonSize;
                    const rowTotal = totalUnits * finalPrice;
                    const active = totalUnits > 0;

                    return (
                      <tr
                        key={product.id}
                        style={{ background: active ? "#eef2ff" : undefined }}
                      >
                        <td style={{ padding: "3px 3px", textAlign: "center" }}>
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              style={{
                                width: 32,
                                height: 32,
                                objectFit: "contain",
                                borderRadius: 6,
                                margin: "0 auto",
                              }}
                            />
                          ) : (
                            "-"
                          )}
                        </td>
                        <td
                          style={{
                            padding: "3px 3px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {product.barcode || "-"}
                        </td>
                        <td
                          style={{
                            padding: "3px 3px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {product.name}
                        </td>
                        <td style={{ padding: "3px 3px", whiteSpace: "nowrap" }}>
                          {toPersianDigits(cartonSize)}
                        </td>
                        <td style={{ padding: "3px 3px" }}>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={cartonsValue}
                            onChange={(e) => updateCartons(product.id, e.target.value)}
                            placeholder="۰"
                            style={{ width: "100%", minWidth: 45, padding: "3px 4px", fontSize: 10 }}
                          />
                        </td>
                        <td style={{ padding: "3px 3px", whiteSpace: "nowrap", fontWeight: 700 }}>
                          {toPersianDigits(totalUnits)}
                        </td>
                        <td style={{ padding: "3px 3px", whiteSpace: "nowrap" }}>
                          {money(product.consumer_price)}
                        </td>
                        <td style={{ padding: "3px 3px", whiteSpace: "nowrap" }}>
                          {toPersianDigits(discount)}٪
                        </td>
                        <td style={{ padding: "3px 3px", whiteSpace: "nowrap" }}>
                          {money(finalPrice)}
                        </td>
                        <td style={{ padding: "3px 3px", whiteSpace: "nowrap" }}>
                          <strong>{money(rowTotal)}</strong>
                        </td>
                      </tr>
                    );
                  })}

                  {productsInCategory.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: "center", padding: 30, color: "#64748b" }}>
                        کالایی در این گروه پیدا نشد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* نوار پایین ثابت: جمع سفارش و دکمه‌ی ثبت */}
      <div
        style={{
          position: "relative",
          bottom: 0,
          right: 0,
          left: 0,
          background: "#fff",
          borderTop: "1px solid #e2e8f0",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          boxShadow: "0 -6px 20px rgba(15,23,42,.06)",
          
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShoppingCart size={20} color="#4f46e5" />
          <span>
            {toPersianDigits(orderItems.length)} قلم کالا — جمع کل:{" "}
            <strong>{money(orderTotal)}</strong>
          </span>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={submitOrder}
          disabled={saving}
        >
          {saving ? "در حال ثبت..." : "✅ ثبت سفارش"}
        </button>
      </div>
    </AppShell>
  );
}
