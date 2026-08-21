"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { openSalesOrderDocument } from "@/lib/orderDocuments";
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
  customer_group_id?: string | null;
};

type CustomerGroup = {
  id: string;
  name: string;
  primary_customer_id: string;
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
  const [branchCustomers, setBranchCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<CustomerDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [branchId, setBranchId] = useState("");
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
    const [
      { data: customerRows, error: customerError },
      { data: groupRows, error: groupError },
    ] = await Promise.all([
      supabase
        .from("customers")
        .select("id,name,visitor,customer_group_id")
        .order("name", { ascending: true }),
      supabase
        .from("customer_groups")
        .select("id,name,primary_customer_id")
        .order("name", { ascending: true }),
    ]);

    if (customerError) {
      console.error(customerError);
      alert(`خطا در دریافت مشتریان: ${customerError.message}`);
      return;
    }

    if (groupError) {
      console.error(groupError);
      alert(`خطا در دریافت مجموعه‌های مشتری: ${groupError.message}`);
      return;
    }

    const allCustomers = (customerRows || []) as Customer[];
    const groups = (groupRows || []) as CustomerGroup[];

    const groupByParentId = new Map(
      groups.map((group) => [group.primary_customer_id, group])
    );

    const parentIds = new Set(
      groups.map((group) => group.primary_customer_id)
    );

    // فقط مشتری مستقل و «مشتری مادر» مجموعه‌ها در فهرست اصلی نمایش داده می‌شوند.
    // شعبه‌ها عمداً از این لیست حذف می‌شوند و فقط بعد از انتخاب مجموعه
    // در کادر جداگانه «انتخاب شعبه» نمایش داده خواهند شد.
    const parentCustomers = allCustomers
      .filter((customer) => parentIds.has(customer.id) || !customer.customer_group_id)
      .map((customer) => {
        const group = groupByParentId.get(customer.id);

        return {
          ...customer,
          name: group?.name || customer.name,
          customer_group_id: group?.id || null,
        };
      });

    setCustomers(parentCustomers);
    setBranchCustomers(allCustomers);
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
    setBranchId("");

    const customer = customers.find((item) => item.id === id);

    if (!customer) {
      setVisitor("");
      setDiscounts([]);
      return;
    }

    const branches = customer.customer_group_id
      ? branchCustomers.filter(
          (item) =>
            item.customer_group_id === customer.customer_group_id &&
            item.id !== customer.id
        )
      : [];

    // برای مشتری مستقل، ویزیتور همان مشتری است.
    // برای مجموعه، پس از انتخاب شعبه ویزیتور شعبه جایگزین می‌شود.
    setVisitor(branches.length === 0 ? customer.visitor || "" : "");

    // تخفیف‌ها از مشتری مادر/مجموعه خوانده می‌شوند، نه از شعبه.
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


  function normalizeExcelBarcode(value: unknown) {
    return String(value ?? "")
      .trim()
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/\.0+$/, "");
  }

  async function downloadOrderExcelTemplate() {
    try {
      const worksheet = XLSX.utils.aoa_to_sheet([
        ["بارکد", "تعداد کارتن"],
        ["مثال: 1234567890", 10],
        ["مثال: 1234567891", 5],
        ["مثال: 1234567892", 8],
      ]);

      worksheet["!cols"] = [{ wch: 24 }, { wch: 18 }];

      const guideSheet = XLSX.utils.aoa_to_sheet([
        ["راهنما"],
        ["بارکد: بارکد دقیق کالای موجود در سیستم را وارد کنید."],
        ["تعداد کارتن: تعداد نهایی کارتن موردنظر برای سفارش."],
        ["برای هر بارکد فقط یک ردیف وارد کنید."],
        ["بعد از بارگذاری فایل، اقلام سفارش در همین صفحه نمایش داده می‌شوند."],
        ["در پایان روی «ثبت سفارش» کلیک کنید."],
      ]);
      guideSheet["!cols"] = [{ wch: 80 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "ثبت سفارش");
      XLSX.utils.book_append_sheet(workbook, guideSheet, "راهنما");
      XLSX.writeFile(workbook, "نمونه فایل اکسل ثبت سفارش.xlsx");
    } catch (error) {
      console.error("EXCEL TEMPLATE ERROR:", error);
      alert("ساخت نمونه فایل اکسل انجام نشد.");
    }
  }

  async function importOrderFromExcel(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportingExcel(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("هیچ برگه‌ای در فایل اکسل پیدا نشد.");

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[sheetName],
        { defval: "", raw: false }
      );
      if (!rows.length) throw new Error("فایل اکسل خالی است.");

      const headers = Object.keys(rows[0] || {});
      const barcodeHeader = headers.find((h) => {
        const v = h.trim().toLowerCase();
        return v === "بارکد" || v === "barcode" || v === "کد کالا" || v === "کدکالا";
      });
      const quantityHeader = headers.find((h) => {
        const v = h.trim().toLowerCase();
        return (
          v === "تعداد کارتن" ||
          v === "تعدادکارتن" ||
          v === "تعداد" ||
          v === "cartons" ||
          v === "qty" ||
          v === "quantity"
        );
      });

      if (!barcodeHeader || !quantityHeader) {
        throw new Error(
          "فرمت فایل صحیح نیست.\nستون‌های «بارکد» و «تعداد کارتن» باید وجود داشته باشند."
        );
      }

      const productMap = new Map<string, Product>();
      products.forEach((product) => {
        const barcode = normalizeExcelBarcode(product.barcode);
        if (barcode) productMap.set(barcode, product);
      });

      const nextQuantities = { ...quantities };
      const errors: string[] = [];
      let importedCount = 0;

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const barcode = normalizeExcelBarcode(row[barcodeHeader]);
        const cartonsRaw = normalizeExcelBarcode(row[quantityHeader]);

        if (!barcode) {
          errors.push(`ردیف ${rowNumber}: بارکد خالی است.`);
          return;
        }

        if (cartonsRaw === "") {
          errors.push(`ردیف ${rowNumber}: تعداد کارتن خالی است.`);
          return;
        }

        const cartons = Number(cartonsRaw);
        if (!Number.isInteger(cartons) || cartons < 0) {
          errors.push(`ردیف ${rowNumber}: تعداد کارتن معتبر نیست.`);
          return;
        }

        const product = productMap.get(barcode);
        if (!product) {
          errors.push(`ردیف ${rowNumber}: بارکد ${barcode} در سیستم پیدا نشد.`);
          return;
        }

        nextQuantities[product.id] = String(cartons);
        importedCount += 1;
      });

      setQuantities(nextQuantities);

      let message = `بارگذاری اکسل انجام شد.\n\nتعداد کالاهای واردشده: ${importedCount}`;
      if (errors.length) {
        message += `\n\nخطاها: ${errors.length}\n${errors.slice(0, 12).join("\n")}`;
        if (errors.length > 12) {
          message += `\n... و ${errors.length - 12} خطای دیگر`;
        }
      }

      alert(message);
    } catch (error: any) {
      console.error("EXCEL IMPORT ERROR:", error);
      alert(error?.message || "خطایی هنگام خواندن فایل اکسل رخ داد.");
    } finally {
      setImportingExcel(false);
    }
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
      alert("لطفاً مشتری / مجموعه را انتخاب کنید.");
      return;
    }

    if (orderItems.length === 0) {
      alert("حداقل یک کالا برای سفارش انتخاب کنید.");
      return;
    }

    const selectedCustomer = customers.find((item) => item.id === customerId);

    if (!selectedCustomer) {
      alert("مشتری / مجموعه انتخاب‌شده پیدا نشد.");
      return;
    }

    const isGroupParent = Boolean(selectedCustomer.customer_group_id);

    const availableBranches = isGroupParent
      ? branchCustomers.filter(
          (item) =>
            item.customer_group_id === selectedCustomer.customer_group_id &&
            item.id !== selectedCustomer.id
        )
      : [];

    if (isGroupParent && availableBranches.length === 0) {
      alert("این مجموعه هنوز هیچ شعبه‌ای ندارد.");
      return;
    }

    if (isGroupParent && !branchId) {
      alert("این مجموعه شعبه دارد؛ برای ثبت سفارش حتماً باید نام شعبه را انتخاب کنید.");
      return;
    }

    const actualCustomer = isGroupParent
      ? availableBranches.find((branch) => branch.id === branchId)
      : selectedCustomer;

    if (!actualCustomer) {
      alert("شعبه انتخاب‌شده پیدا نشد.");
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
          customer_id: actualCustomer.id,
          customer_name: actualCustomer.name,
          visitor: visitor || actualCustomer.visitor || selectedCustomer.visitor || null,
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

      await openSalesOrderDocument(order.id, { invoiceTotal: orderTotal });

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
            <label>مشتری / مجموعه</label>
            <select
              className="input"
              value={customerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
            >
              <option value="">انتخاب مشتری / مجموعه</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}{customer.customer_group_id ? " (مجموعه)" : ""}
                </option>
              ))}
            </select>
          </div>

          {(() => {
            const selectedCustomer = customers.find((item) => item.id === customerId);
            const selectedGroupId = selectedCustomer?.customer_group_id || null;

            if (!selectedGroupId) return null;

            const branches = branchCustomers.filter(
              (item) =>
                item.customer_group_id === selectedGroupId &&
                item.id !== selectedCustomer?.id
            );

            return (
              <div className="form-field">
                <label>
                  نام شعبه
                  <span style={{ color: "#dc2626", marginRight: 4 }}>*</span>
                </label>

                <select
                  className="input"
                  value={branchId}
                  disabled={branches.length === 0}
                  onChange={(e) => {
                    const nextBranchId = e.target.value;
                    setBranchId(nextBranchId);

                    const branch = branches.find((item) => item.id === nextBranchId);
                    setVisitor(branch?.visitor || selectedCustomer?.visitor || "");
                  }}
                >
                  <option value="">
                    {branches.length > 0
                      ? "انتخاب شعبه"
                      : "این مجموعه هنوز شعبه‌ای ندارد"}
                  </option>

                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>

                {branches.length > 0 && (
                  <div style={{ marginTop: 5, fontSize: 12, color: "#64748b" }}>
                    فقط شعب زیرمجموعه «{selectedCustomer?.name}» در این فهرست نمایش داده می‌شوند.
                  </div>
                )}
              </div>
            );
          })()}

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

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <label
              className="btn btn-success"
              style={{
                position: "relative",
                overflow: "hidden",
                cursor: importingExcel ? "wait" : "pointer",
                margin: 0,
              }}
            >
              {importingExcel ? "در حال خواندن اکسل..." : "📥 بارگذاری از اکسل"}
              <input
                type="file"
                accept=".xlsx,.xls"
                disabled={saving || importingExcel}
                onChange={importOrderFromExcel}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: importingExcel ? "wait" : "pointer",
                }}
              />
            </label>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={downloadOrderExcelTemplate}
              disabled={saving || importingExcel}
            >
              📄 نمونه فایل اکسل
            </button>

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
