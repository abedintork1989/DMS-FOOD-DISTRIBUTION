"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { supabase } from "@/lib/supabase";

import { approveOrderDocuments, closeOpenDocumentsForOrder } from "@/lib/orderDocuments";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";


function normalizePersianDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function formatPersianDate(value: string) {
  return value || "";
}

// تبدیل تاریخ شمسی انتخاب شده در تقویم به تاریخ میلادی برای Supabase
function jalaliToGregorian(jy: number, jm: number, jd: number) {
  jy -= 979;
  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  let gy = 1600 + 400 * Math.floor(days / 146097);
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

  const gd = days + 1;
  const sal_a = [
    0,
    31,
    ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
  ];

  let gm = 0;
  let day = gd;

  while (gm < 13 && day > sal_a[gm]) {
    day -= sal_a[gm];
    gm++;
  }

  return `${gy}-${String(gm).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

type Product = {
  id: string;
  name: string;
  barcode?: string | null;
  category?: string | null;
  image_url?: string | null;
  quantity_per_carton?: number | null;
  consumer_price?: number | null;
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [groupParentName, setGroupParentName] = useState<string | null>(null);
  const [isOrderAssignedToGroupParent, setIsOrderAssignedToGroupParent] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [discounts, setDiscounts] = useState<any[]>([]);

  // تاریخ ارسال سفارش (شمسی مستقل)
  const [sendDate, setSendDate] = useState("");
  const [showSendPicker, setShowSendPicker] = useState(false);

  // تبدیل هر نوع تاریخ دیتابیس به نمایش شمسی
  // created_at معمولاً ISO/Gregorian است
  // delivery_date ممکن است تاریخ میلادی یا شمسی باشد
  function toJalaliDate(dateValue: any) {
    if (!dateValue) return "-";

    try {
      const value = String(dateValue).trim();

      // اگر قبلاً شمسی ذخیره شده باشد
      const jalaliParts = value.split(" ")[0].split("/");
      if (
        jalaliParts.length === 3 &&
        Number(jalaliParts[0]) > 1300 &&
        Number(jalaliParts[0]) < 1500
      ) {
        const months = [
          "فروردین","اردیبهشت","خرداد","تیر",
          "مرداد","شهریور","مهر","آبان",
          "آذر","دی","بهمن","اسفند"
        ];

        return `${Number(jalaliParts[2])} ${months[Number(jalaliParts[1]) - 1]} ${jalaliParts[0]}`;
      }

      // تاریخ میلادی (created_at و delivery_date دیتابیس)
      const date = new Date(value);

      if (!isNaN(date.getTime())) {
        const jalali = new DateObject({
          date,
          calendar: persian,
          locale: persian_fa,
        });

        const months = [
          "فروردین","اردیبهشت","خرداد","تیر",
          "مرداد","شهریور","مهر","آبان",
          "آذر","دی","بهمن","اسفند"
        ];

        return `${jalali.day} ${months[jalali.month.number - 1]} ${jalali.year}`;
      }

      return value;
    } catch {
      return "-";
    }
  }

  // مقدار مناسب برای DatePicker شمسی
  function toPersianDateValue(dateValue: any) {
    if (!dateValue) return "";

    try {
      const value = String(dateValue).trim();

      const parts = value.split(" ")[0].split("/");

      // قبلاً شمسی بوده
      if (
        parts.length === 3 &&
        Number(parts[0]) > 1300 &&
        Number(parts[0]) < 1500
      ) {
        return `${parts[0]}/${String(parts[1]).padStart(2,"0")}/${String(parts[2]).padStart(2,"0")}`;
      }

      // میلادی را به شمسی تبدیل کن
      const date = new Date(value);

      if (!isNaN(date.getTime())) {
        const jalali = new DateObject({
          date,
          calendar: persian,
          locale: persian_fa,
        });

        return `${jalali.year}/${String(jalali.month.number).padStart(2,"0")}/${String(jalali.day).padStart(2,"0")}`;
      }

      return "";
    } catch {
      return "";
    }
  }

  // افزودن کالای جدید
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  // کالاهایی که در پنجره افزودن انتخاب شده‌اند
  const [selectedProductIds, setSelectedProductIds] = useState<
    Record<string, boolean>
  >({});

  // تعداد کارتن پیشنهادی هر کالای انتخاب‌شده
  const [pendingCartons, setPendingCartons] = useState<
    Record<string, string>
  >({});

  const [importingExcel, setImportingExcel] = useState(false);

  useEffect(() => {
    if (id) loadOrder();
  }, [id]);

  async function loadOrder() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log("SESSION:", session);

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(`*, customers(name, visitor, province, customer_group_id, default_discount_percent)`)
        .eq("id", id)
        .single();

      if (orderError) {
        console.log("ORDER ERROR:", orderError);
        setLoading(false);
        return;
      }

      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          *,
          products(
            name,
            barcode,
            category,
            quantity_per_carton,
            image_url,
            consumer_price
          )
        `)
        .eq("order_id", id);

      if (itemsError) {
        console.log("ITEMS ERROR:", itemsError);
        setLoading(false);
        return;
      }

      const finalData = { ...orderData, order_items: items || [] };
      setOrder(finalData);
      setEditedItems(finalData.order_items || []);

      setGroupParentName(null);
      setIsOrderAssignedToGroupParent(false);

      if (orderData.customers?.customer_group_id) {
        const { data: groupRow, error: groupError } = await supabase
          .from("customer_groups")
          .select("name,primary_customer_id")
          .eq("id", orderData.customers.customer_group_id)
          .maybeSingle();

        if (!groupError && groupRow) {
          setGroupParentName(groupRow.name || null);
          setIsOrderAssignedToGroupParent(
            String(orderData.customer_id) ===
              String(groupRow.primary_customer_id)
          );
        }
      }

      setSendDate(
        toPersianDateValue(orderData.send_date)
      );

      let discountCustomerId = orderData.customer_id;

// اگر سفارش برای یکی از شعبه‌های مجموعه است
// تخفیف باید از مشتری مادر خوانده شود
if (orderData.customers?.customer_group_id) {
  const { data: groupRow, error: groupError } =
    await supabase
      .from("customer_groups")
      .select("primary_customer_id")
      .eq(
        "id",
        orderData.customers.customer_group_id
      )
      .maybeSingle();

  if (!groupError && groupRow?.primary_customer_id) {
    discountCustomerId = groupRow.primary_customer_id;
  }
}

if (discountCustomerId) {
  const { data: discountData, error: discountError } =
    await supabase
      .from("customer_group_discounts")
      .select("category,discount_percent")
      .eq(
        "customer_id",
        discountCustomerId
      );

  if (discountError) {
    console.log("DISCOUNT ERROR:", discountError);
    setDiscounts([]);
  } else {
    setDiscounts(discountData || []);
  }
}
    } catch (error) {
      console.log("LOAD ORDER ERROR:", error);
    }
    setLoading(false);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        barcode,
        category,
        image_url,
        quantity_per_carton,
        consumer_price
      `)
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      console.log("PRODUCTS ERROR:", error);
      alert(`خطا در دریافت کالاها: ${error.message}`);
      return;
    }

    setProducts(data || []);
  }

  function getCurrentItem(item: any) {
    return editedItems.find((x: any) => x.id === item.id) || item;
  }

  // تعداد کارتن اولیه‌ای که ویزیتور ثبت کرده است.
  // این مقدار فقط از quantity می‌آید و در ویرایش سفارش دست‌نخورده می‌ماند.
  function getOriginalCartons(item: any) {
    const product = item.products || {};
    const cartonSize = Math.max(
      Number(product.quantity_per_carton || 1),
      1
    );

    return Math.ceil(
      Number(item.quantity || 0) / cartonSize
    );
  }

  // تعداد نهایی سفارش.
  // اگر سفارش قدیمی باشد و این ستون هنوز مقدار نداشته باشد،
  // موقتاً از تعداد کارتن اولیه استفاده می‌کنیم.
  function getFinalOrderQuantity(item: any) {
    const value = item.final_order_quantity;

    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      return Number(value);
    }

    return getOriginalCartons(item);
  }

  // جمع هر ردیف بر اساس «تعداد نهایی سفارش» است،
  // نه تعداد کارتن اولیه و نه quantity ویزیتور.
  function calculateRowTotal(item: any) {
    const currentItem = getCurrentItem(item);
    const product = currentItem.products || {};
    const cartonSize = Math.max(
      Number(product.quantity_per_carton || 1),
      1
    );

    const finalCartons =
      getFinalOrderQuantity(currentItem);

    return (
      finalCartons *
      cartonSize *
      Number(currentItem.final_price || 0)
    );
  }

  // جمع کل سفارش نیز فقط بر اساس تعداد نهایی سفارش محاسبه می‌شود.
  function calculateGrandTotal() {
    return editedItems.reduce(
      (sum: number, item: any) =>
        sum + calculateRowTotal(item),
      0
    );
  }

  function startEditing() {
    if (order.status !== "pending") {
      alert(
        "این سفارش بعد از تأیید قابل ویرایش در صفحه سفارشات نیست."
      );
      return;
    }

    setEditedItems(order.order_items || []);
    setIsEditing(true);
  }

  function cancelEditing() {
    setEditedItems(order.order_items || []);
    setIsEditing(false);
    setShowAddProduct(false);
    setSelectedProductIds({});
    setPendingCartons({});

    setSendDate(
      toPersianDateValue(order.send_date)
    );
  }

  function openAddProduct() {
    setProductSearch("");
    setSelectedProductIds({});
    setPendingCartons({});
    setShowAddProduct(true);
    loadProducts();
  }

  function getDiscountForCategory(category: string | null | undefined) {
    const normalize = (value: any) =>
      String(value || "")
        .trim()
        .replace(/\s+/g, "")
        .toLowerCase();

    const targetCategory = normalize(category);

    const existing = editedItems.find(
      (item: any) =>
        normalize(item.products?.category || item.category) === targetCategory &&
        item.discount_percent !== null &&
        item.discount_percent !== undefined
    );

    if (existing) {
      return Number(existing.discount_percent || 0);
    }

    const categoryDiscount = discounts.find(
      (row: any) => normalize(row.category) === targetCategory
    );

    if (categoryDiscount?.discount_percent !== null && categoryDiscount?.discount_percent !== undefined) {
      return Number(categoryDiscount.discount_percent || 0);
    }

    return Number(order?.customers?.default_discount_percent || 0);
  }

  // انتخاب یا لغو انتخاب یک کالا
  function toggleProductSelection(product: Product) {
    const exists = editedItems.some(
      (item: any) => item.product_id === product.id
    );

    if (exists) return;

    setSelectedProductIds((previous) => {
      const next = { ...previous };

      if (next[product.id]) {
        delete next[product.id];

        setPendingCartons((cartons) => {
          const updated = { ...cartons };
          delete updated[product.id];
          return updated;
        });
      } else {
        next[product.id] = true;

        setPendingCartons((cartons) => ({
          ...cartons,
          [product.id]: "1",
        }));
      }

      return next;
    });
  }

  // تغییر تعداد کارتن همان ردیف
  function changePendingCartons(
    productId: string,
    value: string
  ) {
    if (value === "") {
      setPendingCartons((previous) => ({
        ...previous,
        [productId]: "",
      }));
      return;
    }

    const number = Number(value);

    if (
      !Number.isInteger(number) ||
      number < 1
    ) {
      return;
    }

    setPendingCartons((previous) => ({
      ...previous,
      [productId]: value,
    }));
  }

  // ثبت همه کالاهای انتخاب‌شده به صورت یکجا
  function addSelectedProductsToOrder() {
    const selectedIds = Object.keys(
      selectedProductIds
    ).filter(
      (productId) =>
        selectedProductIds[productId]
    );

    if (selectedIds.length === 0) {
      alert("حداقل یک کالا را انتخاب کنید.");
      return;
    }

    const newItems: any[] = [];

    for (const productId of selectedIds) {
      const product = products.find(
        (p) => p.id === productId
      );

      if (!product) continue;

      const cartons = Number(
        pendingCartons[product.id] || "0"
      );

      if (
        !Number.isInteger(cartons) ||
        cartons < 1
      ) {
        alert(
          `تعداد کارتن «${product.name}» باید عدد صحیح و بزرگ‌تر از صفر باشد.`
        );
        return;
      }

      const alreadyExists = editedItems.some(
        (item: any) =>
          item.product_id === product.id
      );

      if (alreadyExists) continue;

      const cartonSize = Math.max(
        Number(
          product.quantity_per_carton || 1
        ),
        1
      );

      // کالای جدید را ویزیتور سفارش نداده است.
      // بنابراین تعداد اولیه سفارش = صفر است.
      const quantity = 0;

      const consumerPrice = Number(
        product.consumer_price || 0
      );

      const discountPercent =
        getDiscountForCategory(
          product.category
        );

      const finalPrice = Math.round(
        consumerPrice -
          (consumerPrice *
            discountPercent) /
            100
      );

      newItems.push({
        id: `new-${product.id}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
        order_id: id,
        product_id: product.id,
        quantity,
        final_order_quantity: cartons,
        consumer_price:
          consumerPrice,
        discount_percent:
          discountPercent,
        purchase_price:
          finalPrice,
        total_purchase_price:
          cartons *
          cartonSize *
          finalPrice,
        final_price:
          finalPrice,
        products: product,
        isNew: true,
      });
    }

    if (newItems.length === 0) {
      alert(
        "کالای جدیدی برای ثبت وجود ندارد."
      );
      return;
    }

    setEditedItems((previous) => [
      ...previous,
      ...newItems,
    ]);

    setSelectedProductIds({});
    setPendingCartons({});
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
        ["بارکد کالای اول", 10],
        ["بارکد کالای دوم", 5],
        ["بارکد کالای سوم", 8],
      ]);

      worksheet["!cols"] = [{ wch: 22 }, { wch: 18 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "ثبت سفارش");
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([
          ["راهنما"],
          ["ستون «بارکد» باید با بارکد موجود در سیستم مطابقت داشته باشد."],
          ["ستون «تعداد کارتن» تعداد نهایی موردنظر برای سفارش است."],
          ["بعد از واردسازی، برای ذخیره نهایی روی «ثبت و تأیید سفارش» بزنید."],
        ]),
        "راهنما"
      );

      XLSX.writeFile(workbook, "نمونه فایل اکسل سفارش.xlsx");
    } catch (error) {
      console.error("EXCEL TEMPLATE ERROR:", error);
      alert("ساخت فایل نمونه اکسل انجام نشد.");
    }
  }

  async function importOrderQuantitiesFromExcel(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!isEditing || !canEditInOrdersPage) {
      alert("ابتدا سفارش را وارد حالت ویرایش کنید.");
      return;
    }

    setImportingExcel(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("هیچ برگه‌ای در فایل اکسل پیدا نشد.");
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[sheetName],
        { defval: "" }
      );

      if (!rows.length) {
        throw new Error("فایل اکسل خالی است.");
      }

      const headers = Object.keys(rows[0]);
      const barcodeHeader = headers.find((h) => {
        const value = h.trim().toLowerCase();
        return value === "بارکد" || value === "barcode" || value === "کد کالا";
      });

      const quantityHeader = headers.find((h) => {
        const value = h.trim().toLowerCase();
        return (
          value === "تعداد کارتن" ||
          value === "تعداد" ||
          value === "cartons" ||
          value === "qty"
        );
      });

      if (!barcodeHeader || !quantityHeader) {
        throw new Error(
          "فرمت فایل صحیح نیست. ستون‌های «بارکد» و «تعداد کارتن» را داشته باشید."
        );
      }

      const { data: importedProducts, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          name,
          barcode,
          category,
          image_url,
          quantity_per_carton,
          consumer_price
        `)
        .eq("active", true);

      if (productsError) throw productsError;

      const productMap = new Map<string, Product>();
      (importedProducts || []).forEach((product: Product) => {
        const barcode = normalizeExcelBarcode(product.barcode);
        if (barcode) productMap.set(barcode, product);
      });

      const nextItems = [...editedItems];
      const errors: string[] = [];
      let updatedCount = 0;
      let addedCount = 0;

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const barcode = normalizeExcelBarcode(row[barcodeHeader]);
        const cartons = Number(normalizeExcelBarcode(row[quantityHeader]));

        if (!barcode) {
          errors.push(`ردیف ${rowNumber}: بارکد خالی است.`);
          return;
        }

        if (!Number.isInteger(cartons) || cartons < 0) {
          errors.push(`ردیف ${rowNumber}: تعداد کارتن معتبر نیست.`);
          return;
        }

        const product = productMap.get(barcode);

        if (!product) {
          errors.push(
            `ردیف ${rowNumber}: بارکد ${barcode} در سیستم پیدا نشد.`
          );
          return;
        }

        const cartonSize = Math.max(
          Number(product.quantity_per_carton || 1),
          1
        );

        const consumerPrice = Number(product.consumer_price || 0);
        const discountPercent = getDiscountForCategory(product.category);
        const finalPrice = Math.round(
          consumerPrice - (consumerPrice * discountPercent) / 100
        );

        const total = cartons * cartonSize * finalPrice;

        const existingIndex = nextItems.findIndex(
          (item: any) => item.product_id === product.id
        );

        if (existingIndex >= 0) {
          nextItems[existingIndex] = {
            ...nextItems[existingIndex],
            final_order_quantity: cartons,
            consumer_price: consumerPrice,
            discount_percent: discountPercent,
            purchase_price: finalPrice,
            total_purchase_price: total,
            final_price: finalPrice,
            products: product,
          };
          updatedCount += 1;
        } else {
          nextItems.push({
            id: `excel-${product.id}-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`,
            order_id: id,
            product_id: product.id,
            quantity: 0,
            final_order_quantity: cartons,
            consumer_price: consumerPrice,
            discount_percent: discountPercent,
            purchase_price: finalPrice,
            total_purchase_price: total,
            final_price: finalPrice,
            products: product,
            isNew: true,
          });
          addedCount += 1;
        }
      });

      setEditedItems(nextItems);

      let message =
        `واردسازی اکسل انجام شد.\n\n` +
        `به‌روزرسانی: ${updatedCount} کالا\n` +
        `افزوده‌شده: ${addedCount} کالا`;

      if (errors.length) {
        message += `\nخطاها: ${errors.length}\n\n${errors
          .slice(0, 10)
          .join("\n")}`;
      }

      alert(
        `${message}\n\nبرای ذخیره نهایی، روی «ثبت و تأیید سفارش» کلیک کنید.`
      );
    } catch (error: any) {
      console.error("EXCEL IMPORT ERROR:", error);
      alert(error?.message || "خطایی در خواندن فایل اکسل رخ داد.");
    } finally {
      setImportingExcel(false);
    }
  }

  function getStatusLabel(status: any) {
    const value = String(status || "").toLowerCase();

    if (
      value === "approved" ||
      value === "confirmed" ||
      value === "تایید شده" ||
      value === "تأیید شده"
    ) {
      return "تایید شده";
    }

    if (value === "pending" || value === "در انتظار") {
      return "در انتظار";
    }

    if (value === "rejected" || value === "رد شده") {
      return "رد شده";
    }

    return status || "-";
  }

  async function cancelOrder() {
    if (saving) return;

    if (order.status !== "pending" && order.status !== "approved") {
      alert("این سفارش در وضعیت فعلی قابل ابطال نیست.");
      return;
    }

    const confirmation = window.confirm(
      order.status === "approved"
        ? "آیا از ابطال سفارش تأیید شده مطمئن هستید؟"
        : "آیا از ابطال سفارش در انتظار تأیید مطمئن هستید؟"
    );

    if (!confirmation) return;

    setSaving(true);

    try {
      const cancelledFrom = order.status;

      const { error } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          cancelled_from: cancelledFrom,
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        console.log("CANCEL ORDER ERROR:", error);
        alert(`خطا در ابطال سفارش: ${error.message}`);
        return;
      }

      await closeOpenDocumentsForOrder(id);

      setIsEditing(false);
      setShowAddProduct(false);
      setSelectedProductIds({});
      setPendingCartons({});

      await loadOrder();

      alert(
        cancelledFrom === "approved"
          ? "سفارش تأیید شده با موفقیت ابطال شد."
          : "سفارش با موفقیت ابطال شد."
      );
    } catch (error: any) {
      console.log("CANCEL ORDER ERROR:", error);
      alert(
        `خطا در ابطال سفارش: ${
          error?.message || "خطای نامشخص"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function approveOrder() {
    if (saving) return;

    if (order.status !== "pending") {
      alert(
        "این سفارش در این صفحه قابل ذخیره یا بازتأیید نیست."
      );
      setIsEditing(false);
      return;
    }

    // اگر کالاهایی در پنجره افزودن کالا انتخاب شده‌اند
    // ولی هنوز ثبت نشده‌اند، همان لحظه به لیست موقت سفارش اضافه می‌کنیم.
    let itemsToSave = [...editedItems];

    const selectedIds = Object.keys(
      selectedProductIds
    ).filter(
      (productId) =>
        selectedProductIds[productId]
    );

    if (selectedIds.length > 0) {
      const pendingNewItems: any[] = [];

      for (const productId of selectedIds) {
        const product = products.find(
          (p) => p.id === productId
        );

        if (!product) continue;

        const cartons = Number(
          pendingCartons[product.id] || "0"
        );

        if (
          !Number.isInteger(cartons) ||
          cartons < 1
        ) {
          alert(
            `تعداد کارتن «${product.name}» باید عدد صحیح و بزرگ‌تر از صفر باشد.`
          );
          return;
        }

        const alreadyExists =
          itemsToSave.some(
            (item: any) =>
              item.product_id === product.id
          );

        if (alreadyExists) continue;

        const cartonSize = Math.max(
          Number(
            product.quantity_per_carton || 1
          ),
          1
        );

        const quantity =
          cartons * cartonSize;

        const consumerPrice = Number(
          product.consumer_price || 0
        );

        const discountPercent =
          getDiscountForCategory(
            product.category
          );

        const finalPrice = Math.round(
          consumerPrice -
            (consumerPrice *
              discountPercent) /
              100
        );

        pendingNewItems.push({
          id: `new-${product.id}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
          order_id: id,
          product_id: product.id,
          quantity,
          final_order_quantity: cartons,
          consumer_price:
            consumerPrice,
          discount_percent:
            discountPercent,
          purchase_price:
            finalPrice,
          total_purchase_price:
            cartons *
            cartonSize *
            finalPrice,
          final_price:
            finalPrice,
          products: product,
          isNew: true,
        });
      }

      if (pendingNewItems.length > 0) {
        itemsToSave = [
          ...itemsToSave,
          ...pendingNewItems,
        ];
      }
    }

    if (!itemsToSave.length) {
      alert("این سفارش هیچ کالایی ندارد.");
      return;
    }

    if (
      !confirm(
        "آیا از ثبت و تأیید این سفارش مطمئن هستید؟"
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        alert(
          "Session واقعی Supabase پیدا نشد. ابتدا باید با حساب Supabase وارد شوید."
        );
        setSaving(false);
        return;
      }

      // =====================================================
      // کالاهای موجود:
      // quantity دست‌نخورده می‌ماند.
      // فقط final_order_quantity و مبالغ وابسته به آن ذخیره می‌شوند.
      // =====================================================
      for (
        const item of itemsToSave.filter(
          (x: any) => !x.isNew
        )
      ) {
        const product = item.products || {};
        const cartonSize = Math.max(
          Number(
            product.quantity_per_carton || 1
          ),
          1
        );

        const finalOrderQuantity =
          Math.max(
            0,
            Math.floor(
              Number(
                getFinalOrderQuantity(item)
              )
            )
          );

        const finalPrice = Number(
          item.final_price || 0
        );

        const consumerPrice = Number(
          item.consumer_price || 0
        );

        const discountPercent = Number(
          item.discount_percent || 0
        );

        const total =
          finalOrderQuantity *
          cartonSize *
          finalPrice;

        // ابتدا فقط UPDATE را انجام می‌دهیم.
        // نتیجه UPDATE را با SELECT مخلوط نمی‌کنیم تا RLS/RETURNING
        // باعث تشخیص اشتباه نشود.
        const { error: updateItemError } =
          await supabase
            .from("order_items")
            .update({
              // مهم: quantity را اصلاً تغییر نمی‌دهیم.
              final_order_quantity:
                finalOrderQuantity,
              consumer_price:
                consumerPrice,
              discount_percent:
                discountPercent,
              purchase_price:
                finalPrice,
              total_purchase_price:
                total,
              final_price:
                finalPrice,
              // انتقال مقدار تایید شده به انبار در لحظه تایید سفارش
              delivery_cartons:
                finalOrderQuantity,
              delivery_units:
                finalOrderQuantity * cartonSize,
            })
            .eq("id", item.id);

        if (updateItemError) {
          console.log(
            "UPDATE ITEM ERROR:",
            updateItemError
          );

          alert(
            `خطا در ذخیره کالای ${item.id}: ${updateItemError.message}`
          );

          setSaving(false);
          return;
        }

        // حالا مقدار را جداگانه از دیتابیس می‌خوانیم.
        const {
          data: savedItem,
          error: verifyItemError,
        } = await supabase
          .from("order_items")
          .select("id, final_order_quantity")
          .eq("id", item.id)
          .maybeSingle();

        if (verifyItemError) {
          console.log(
            "VERIFY ITEM ERROR:",
            verifyItemError
          );

          alert(
            `ذخیره انجام شد ولی بررسی مجدد کالا خطا داد: ${verifyItemError.message}`
          );

          setSaving(false);
          return;
        }

        if (!savedItem) {
          alert(
            `کالا بعد از ذخیره قابل خواندن نیست.
شناسه کالا: ${item.id}

Policy مربوط به SELECT جدول order_items را بررسی کنید.`
          );

          setSaving(false);
          return;
        }

        if (
          Number(savedItem.final_order_quantity) !==
          finalOrderQuantity
        ) {
          alert(
            `مقدار تعداد نهایی ذخیره نشد.

شناسه کالا: ${item.id}
مقدار موردنظر: ${finalOrderQuantity}
مقدار موجود در دیتابیس: ${savedItem.final_order_quantity}

اگر این دو عدد متفاوت هستند، احتمالاً Trigger یا Rule دیگری مقدار را تغییر می‌دهد.`
          );

          setSaving(false);
          return;
        }
      }

      // =====================================================
      // کالاهای جدید:
      // کالای جدید: تعداد اولیه ویزیتور = صفر
      // final_order_quantity = مقدار نهایی انتخاب‌شده توسط مدیر
      // =====================================================
      const newItems = itemsToSave
        .filter((x: any) => x.isNew)
        .map((item: any) => {
          const product =
            item.products || {};

          const cartonSize = Math.max(
            Number(
              product.quantity_per_carton || 1
            ),
            1
          );

          const finalOrderQuantity =
            Math.max(
              0,
              Math.floor(
                Number(
                  getFinalOrderQuantity(item)
                )
              )
            );

          const finalPrice = Number(
            item.final_price || 0
          );

          return {
            order_id: id,
            product_id: item.product_id,
            // کالای جدید توسط ویزیتور ثبت نشده است؛ بنابراین تعداد اولیه = صفر.
            quantity: 0,
            final_order_quantity:
              finalOrderQuantity,
            consumer_price: Number(
              item.consumer_price || 0
            ),
            discount_percent: Number(
              item.discount_percent || 0
            ),
            purchase_price:
              finalPrice,
            total_purchase_price:
              finalOrderQuantity *
              cartonSize *
              finalPrice,
            final_price:
              finalPrice,
            // مقدار اولیه‌ای که انبار باید دریافت کند
            delivery_cartons:
              finalOrderQuantity,
            delivery_units:
              finalOrderQuantity * cartonSize,
          };
        });

      if (newItems.length) {
        // کالاهایی که همین سفارش از قبل در دیتابیس دارد را دوباره INSERT نکن.
        const { data: existingRows, error: existingError } =
          await supabase
            .from("order_items")
            .select("product_id")
            .eq("order_id", id);

        if (existingError) {
          console.log(
            "EXISTING ITEMS ERROR:",
            existingError
          );
          alert(
            `خطا در بررسی کالاهای سفارش: ${existingError.message}`
          );
          setSaving(false);
          return;
        }

        const existingProductIds =
          (existingRows || []).map(
            (row: any) => row.product_id
          );

        const itemsForInsert =
          newItems.filter(
            (item: any) =>
              !existingProductIds.includes(
                item.product_id
              )
          );

        if (itemsForInsert.length) {
          const { error } =
            await supabase
              .from("order_items")
              .insert(itemsForInsert);

          if (error) {
            console.log(
              "INSERT NEW ITEM ERROR:",
              error
            );
            alert(
              `خطا در اضافه کردن کالای جدید: ${error.message}`
            );
            setSaving(false);
            return;
          }
        }
      }

      // جمع کل بر اساس تعداد نهایی سفارش
      const grandTotal =
        itemsToSave.reduce(
          (sum: number, item: any) =>
            sum + calculateRowTotal(item),
          0
        );

      const gregorianSendDate = sendDate
        ? (() => {
            const parts = sendDate.split("/");
            if (parts.length !== 3) return null;

            return jalaliToGregorian(
              Number(parts[0]),
              Number(parts[1]),
              Number(parts[2])
            );
          })()
        : null;

      const { error: orderUpdateError } = await supabase
        .from("orders")
        .update({
          status: "approved",
          invoice_total: grandTotal,
          send_date: gregorianSendDate,
          warehouse_send_date: null,
        })
        .eq("id", id);

      if (orderUpdateError) {
        console.log(
          "ORDER UPDATE ERROR:",
          orderUpdateError
        );

        alert(
          `خطا در تأیید سفارش: ${orderUpdateError.message}`
        );

        setSaving(false);
        return;
      }

      await approveOrderDocuments(id, {
        invoiceTotal: grandTotal,
        sendDate: gregorianSendDate,
      });

      const {
        data: savedOrder,
        error: verifyOrderError,
      } = await supabase
        .from("orders")
        .select("id, status, invoice_total")
        .eq("id", id)
        .maybeSingle();

      if (verifyOrderError) {
        alert(
          `سفارش ذخیره شد ولی بررسی وضعیت خطا داد: ${verifyOrderError.message}`
        );
        setSaving(false);
        return;
      }

      if (!savedOrder) {
        alert(
          "سفارش بعد از ذخیره قابل خواندن نیست. Policy مربوط به SELECT جدول orders را بررسی کنید."
        );
        setSaving(false);
        return;
      }

      if (
        String(savedOrder.status).toLowerCase() !==
        "approved"
      ) {
        alert(
          `وضعیت سفارش هنوز approved نشده است.
وضعیت فعلی دیتابیس: ${savedOrder.status}`
        );
        setSaving(false);
        return;
      }

      alert(
        "سفارش با موفقیت ذخیره و تأیید شد."
      );

      setSelectedProductIds({});
      setPendingCartons({});
      setShowAddProduct(false);

      setIsEditing(false);
      await loadOrder();
    } catch (error) {
      console.log(
        "APPROVE ERROR:",
        error
      );
      alert(
        "خطایی هنگام ذخیره سفارش رخ داد."
      );
    }

    setSaving(false);
  }

  const filteredProducts = products.filter((product) => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;

    return [
      product.name,
      product.barcode,
      product.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  if (loading) return <div>در حال بارگذاری...</div>;
  if (!order) return <div>سفارش پیدا نشد</div>;

  const isApproved = order.status === "approved";
  const canEditInOrdersPage = order.status === "pending";

  return (
    <AppShell>
      <PageHeader
        title={`جزئیات سفارش ${order.order_number || ""}`}
        subtitle="مشاهده و مدیریت کامل سفارش"
      />

      <div className="panel">
        <h3>اطلاعات سفارش</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 20,
          }}
        >
          <div>
            <strong>شعبه سفارش:</strong>
            <br />
            {order.customers?.name || "-"}
          </div>
          <div>
            <strong>ویزیتور:</strong>
            <br />
            {order.customers?.visitor || "-"}
          </div>

          {isOrderAssignedToGroupParent && (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: 12,
                borderRadius: 8,
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                color: "#9a3412",
              }}
            >
              این سفارش قدیمی مستقیماً برای مشتری مادر ثبت شده است.
              {groupParentName ? ` مجموعه: ${groupParentName}` : ""}
              سفارش‌های جدید این مجموعه باید فقط برای شعبه واقعی ثبت شوند.
            </div>
          )}
          <div>
            <strong>وضعیت:</strong>
            <br />
            {order.status === "pending"
              ? "در انتظار تایید"
              : order.status === "approved"
              ? "تایید شده"
              : order.status === "delivered"
              ? "تحویل داده شد"
              : order.status === "cancelled"
              ? `ابطال (${
                  order.cancelled_from === "approved"
                    ? "تایید شده"
                    : order.cancelled_from === "pending"
                    ? "در انتظار تایید"
                    : "سفارش"
                })`
              : order.status}
          </div>
          <div>
            <strong>تاریخ ثبت سفارش:</strong><br />
            {toJalaliDate(order.created_at)}
          </div>

          <div>
            <strong>تاریخ ارسال سفارش:</strong><br />

            {isEditing && canEditInOrdersPage ? (
              <div style={{ position: "relative", marginTop: 8 }}>
                <DatePicker
                  value={sendDate}
                  calendar={persian}
                  locale={persian_fa}
                  calendarPosition="bottom-right"
                  format="YYYY/MM/DD"
                  onChange={(date:any)=>{
                    if(date){
                      setSendDate(
                        `${date.year}/${String(date.month.number).padStart(2,"0")}/${String(date.day).padStart(2,"0")}`
                      );
                    }
                  }}
                  render={(value, openCalendar)=>(
                    <button
                      type="button"
                      className="input"
                      onClick={openCalendar}
                      style={{
                        width:"100%",
                        direction:"rtl",
                        textAlign:"right",
                        cursor:"pointer",
                        background:"#fff"
                      }}
                    >
                      {sendDate || "انتخاب تاریخ ارسال"}
                    </button>
                  )}
                />
              </div>
            ) : (
              toJalaliDate(order.send_date)
            )}

          </div>
        </div>

        <hr style={{ margin: "30px 0" }} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {!isEditing && canEditInOrdersPage && (
            <button className="btn btn-primary" onClick={startEditing}>
              ✏️ ویرایش سفارش
            </button>
          )}

          {isEditing && canEditInOrdersPage && (
            <>
              <button className="btn btn-primary" onClick={openAddProduct}>
                ➕ افزودن کالای جدید
              </button>
              <label
                className="btn btn-success"
                style={{
                  position: "relative",
                  overflow: "hidden",
                  cursor: importingExcel ? "wait" : "pointer",
                }}
              >
                {importingExcel ? "در حال خواندن اکسل..." : "📥 بارگذاری از اکسل"}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  disabled={saving || importingExcel}
                  onChange={importOrderQuantitiesFromExcel}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0                    ,
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


              <button className="btn btn-primary" onClick={approveOrder} disabled={saving}>
                {saving ? "در حال ثبت..." : "✅ ثبت و تأیید سفارش"}
              </button>

              <button className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>
                لغو ویرایش
              </button>
            </>
          )}

          {!isEditing &&
            (order.status === "pending" || order.status === "approved") && (
              <button
                className="btn btn-danger"
                onClick={cancelOrder}
                disabled={saving}
              >
                ✕ ابطال سفارش
              </button>
            )}
        </div>

        {isEditing && canEditInOrdersPage && (
          <div style={{ marginBottom: 20, padding: 12, borderRadius: 8, background: "#fff8e1", border: "1px solid #f0d98c" }}>
            <strong>حالت ویرایش فعال است</strong>
            <div style={{ marginTop: 5, fontSize: 14 }}>
              می‌توانید تعداد کارتن را تغییر دهید یا کالای جدید به سفارش اضافه کنید.
            </div>
          </div>
        )}

        {/* مودال افزودن چند کالای جدید */}
        {showAddProduct && canEditInOrdersPage && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.45)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              style={{
                background: "#fff",
                width: "95%",
                maxWidth: 1250,
                maxHeight: "90vh",
                overflow: "auto",
                borderRadius: 14,
                padding: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 15,
                  marginBottom: 15,
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>
                    افزودن کالا به سفارش
                  </h3>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: "#64748b",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        padding: "5px 9px",
                        borderRadius: 6,
                        background: "#dcfce7",
                        color: "#166534",
                        fontWeight: 700,
                        marginLeft: 8,
                      }}
                    >
                      🟢 داخل سفارش
                    </span>

                    <span
                      style={{
                        display: "inline-block",
                        padding: "5px 9px",
                        borderRadius: 6,
                        background: "#fed7aa",
                        color: "#9a3412",
                        fontWeight: 700,
                      }}
                    >
                      🟠 انتخاب شده
                    </span>
                  </div>
                </div>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddProduct(false);
                    setSelectedProductIds({});
                    setPendingCartons({});
                  }}
                >
                  × بستن
                </button>
              </div>

              <input
                className="input"
                value={productSearch}
                onChange={(e) =>
                  setProductSearch(e.target.value)
                }
                placeholder="جستجوی نام کالا، بارکد یا گروه کالا..."
                style={{
                  marginBottom: 15,
                }}
              />

              {/* نوار ثبت بالا */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <strong>
                  {Object.keys(
                    selectedProductIds
                  ).filter(
                    (productId) =>
                      selectedProductIds[
                        productId
                      ]
                  ).length}{" "}
                  کالا انتخاب شده
                </strong>

                <button
                  className="btn btn-primary"
                  onClick={
                    addSelectedProductsToOrder
                  }
                >
                  ✅ ثبت کالاهای انتخاب‌شده
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>انتخاب</th>
                      <th>عکس</th>
                      <th>بارکد</th>
                      <th>نام کالا</th>
                      <th>گروه کالا</th>
                      <th>تعداد در کارتن</th>
                      <th>تعداد کارتن پیشنهادی</th>
                      <th>قیمت مصرف‌کننده</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map(
                      (product) => {
                        const selected =
                          !!selectedProductIds[
                            product.id
                          ];

                        const exists =
                          editedItems.some(
                            (item: any) =>
                              item.product_id ===
                              product.id
                          );

                        const rowBackground =
                          exists
                            ? "#dcfce7"
                            : selected
                            ? "#fed7aa"
                            : "#ffffff";

                        return (
                          <tr
                            key={product.id}
                            style={{
                              background:
                                rowBackground,
                              transition:
                                "background 0.15s ease",
                              boxShadow:
                                exists
                                  ? "inset 5px 0 0 #22c55e"
                                  : selected
                                  ? "inset 5px 0 0 #f97316"
                                  : "none",
                              cursor:
                                exists
                                  ? "default"
                                  : "pointer",
                            }}
                            onClick={() => {
                              if (!exists) {
                                toggleProductSelection(
                                  product
                                );
                              }
                            }}
                          >
                            {/* انتخاب */}
                            <td>
                              {exists ? (
                                <span
                                  style={{
                                    display:
                                      "inline-block",
                                    padding:
                                      "6px 10px",
                                    borderRadius:
                                      7,
                                    background:
                                      "#bbf7d0",
                                    color:
                                      "#166534",
                                    fontWeight:
                                      700,
                                  }}
                                >
                                  ✓ در سفارش
                                </span>
                              ) : (
                                <button
                                  className={
                                    selected
                                      ? "btn btn-primary"
                                      : "btn btn-secondary"
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleProductSelection(
                                      product
                                    );
                                  }}
                                  style={{
                                    minWidth: 90,
                                  }}
                                >
                                  {selected
                                    ? "✓ انتخاب شد"
                                    : "انتخاب"}
                                </button>
                              )}
                            </td>

                            {/* عکس */}
                            <td>
                              {product.image_url ? (
                                <img
                                  src={
                                    product.image_url
                                  }
                                  alt={
                                    product.name
                                  }
                                  style={{
                                    width: 50,
                                    height: 50,
                                    objectFit:
                                      "contain",
                                    borderRadius: 6,
                                  }}
                                />
                              ) : (
                                "-"
                              )}
                            </td>

                            {/* بارکد */}
                            <td>
                              {product.barcode ||
                                "-"}
                            </td>

                            {/* نام */}
                            <td>
                              {product.name}
                            </td>

                            {/* گروه */}
                            <td>
                              {product.category ||
                                "-"}
                            </td>

                            {/* تعداد داخل کارتن */}
                            <td>
                              {Number(
                                product.quantity_per_carton ||
                                  1
                              ).toLocaleString()}
                            </td>

                            {/* تعداد کارتن پیشنهادی */}
                            <td>
                              {exists ? (
                                <span
                                  style={{
                                    color:
                                      "#166534",
                                    fontWeight:
                                      700,
                                  }}
                                >
                                  {Math.ceil(
                                    Number(
                                      editedItems.find(
                                        (item: any) =>
                                          item.product_id ===
                                          product.id
                                      )?.quantity ||
                                        0
                                    ) /
                                      Math.max(
                                        Number(
                                          product.quantity_per_carton ||
                                            1
                                        ),
                                        1
                                      )
                                  )}
                                </span>
                              ) : selected ? (
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "stretch",
                                    gap: 4,
                                    direction: "ltr",
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 3,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      aria-label="افزایش تعداد کارتن"
                                      onClick={() => {
                                        const current = Number(
                                          pendingCartons[product.id] || 0
                                        );
                                        changePendingCartons(
                                          product.id,
                                          String(current + 1)
                                        );
                                      }}
                                      style={{
                                        width: 28,
                                        height: 22,
                                        border: "1px solid #f97316",
                                        borderRadius: 5,
                                        background: "#fff7ed",
                                        color: "#c2410c",
                                        fontSize: 16,
                                        fontWeight: 900,
                                        lineHeight: 1,
                                        cursor: "pointer",
                                      }}
                                    >
                                      +
                                    </button>

                                    <button
                                      type="button"
                                      aria-label="کاهش تعداد کارتن"
                                      onClick={() => {
                                        const current = Number(
                                          pendingCartons[product.id] || 1
                                        );
                                        if (current <= 1) return;
                                        changePendingCartons(
                                          product.id,
                                          String(current - 1)
                                        );
                                      }}
                                      style={{
                                        width: 28,
                                        height: 22,
                                        border: "1px solid #fed7aa",
                                        borderRadius: 5,
                                        background: "#ffffff",
                                        color: "#9a3412",
                                        fontSize: 16,
                                        fontWeight: 900,
                                        lineHeight: 1,
                                        cursor:
                                          Number(
                                            pendingCartons[product.id] || 1
                                          ) <= 1
                                            ? "not-allowed"
                                            : "pointer",
                                        opacity:
                                          Number(
                                            pendingCartons[product.id] || 1
                                          ) <= 1
                                            ? 0.5
                                            : 1,
                                      }}
                                    >
                                      −
                                    </button>
                                  </div>

                                  <input
                                    className="input"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={
                                      pendingCartons[product.id] || ""
                                    }
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      changePendingCartons(
                                        product.id,
                                        e.target.value
                                      );
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="تعداد"
                                    style={{
                                      width: 82,
                                      padding: 7,
                                      fontWeight: 700,
                                      border: "2px solid #f97316",
                                      background: "#fff7ed",
                                      textAlign: "center",
                                    }}
                                  />
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>

                            {/* قیمت */}
                            <td>
                              {Number(
                                product.consumer_price ||
                                  0
                              ).toLocaleString()}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              {/* نوار ثبت پایین */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 15,
                }}
              >
                <span
                  style={{
                    color: "#64748b",
                    fontSize: 14,
                  }}
                >
                  تعداد انتخاب‌شده:{" "}
                  {
                    Object.keys(
                      selectedProductIds
                    ).filter(
                      (productId) =>
                        selectedProductIds[
                          productId
                        ]
                    ).length
                  }
                </span>

                <button
                  className="btn btn-primary"
                  onClick={
                    addSelectedProductsToOrder
                  }
                >
                  ✅ ثبت کالاهای انتخاب‌شده
                </button>
              </div>

              {filteredProducts.length ===
                0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: 30,
                    color: "#64748b",
                  }}
                >
                  کالایی با این مشخصات پیدا نشد.
                </div>
              )}
            </div>
          </div>
        )}

        <h3>کالاهای سفارش</h3>

        <div
          className="table-wrap"
          style={{
            width: "100%",
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: "65vh",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <table
            style={{
              minWidth: 1500,
              width: "max-content",
              fontSize: 12,
              tableLayout: "auto",
            }}
          >
            <thead>
              <tr>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>عکس</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>ردیف</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>بارکد</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>کالا</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>گروه کالا</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>تعداد اولیه سفارش (کارتن)</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>تعداد نهایی سفارش (کارتن)</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>تعداد جزء</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>قیمت مصرف کننده</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>تخفیف</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>قیمت نهایی</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>جمع</th>
              </tr>
            </thead>

            <tbody>
              {editedItems.map(
                (item: any, index: number) => {
                  const currentItem =
                    getCurrentItem(item);

                  const product =
                    currentItem.products || {};

                  const quantityPerCarton =
                    Math.max(
                      Number(
                        product.quantity_per_carton ||
                          1
                      ),
                      1
                    );

                  // این مقدار، مقدار اولیه ویزیتور است
                  // و در حالت ویرایش هرگز تغییر نمی‌کند.
                  const originalCartons =
                    getOriginalCartons(
                      currentItem
                    );

                  const quantity = Number(
                    currentItem.quantity || 0
                  );

                  const finalOrderQuantity =
                    getFinalOrderQuantity(
                      currentItem
                    );

                  const rowTotal =
                    calculateRowTotal(
                      currentItem
                    );

                  return (
                    <tr
                      key={item.id}
                      style={{
                        background:
                          isEditing &&
                          finalOrderQuantity === 0
                            ? "#fff1f2"
                            : undefined,
                      }}
                    >
                      <td>
                        {product.image_url ? (
                          <img
                            src={
                              product.image_url
                            }
                            alt={
                              product.name ||
                              "product"
                            }
                            style={{
                              width: 55,
                              height: 55,
                              objectFit:
                                "contain",
                              borderRadius: 7,
                            }}
                          />
                        ) : (
                          "-"
                        )}
                      </td>

                      <td>{index + 1}</td>

                      <td>
                        {product.barcode ||
                          "-"}
                      </td>

                      <td>
                        {product.name || "-"}
                      </td>

                      <td>
                        {product.category ||
                          "-"}
                      </td>

                      {/* تعداد کارتن اولیه ویزیتور */}
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                          }}
                        >
                          {originalCartons.toLocaleString()}
                        </span>
                      </td>

                      {/* فقط این ستون قابل ویرایش است */}
                      <td>
                        {isEditing ? (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "stretch",
                              gap: 4,
                              direction: "ltr",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 3,
                              }}
                            >
                              <button
                                type="button"
                                aria-label="افزایش تعداد"
                                onClick={() => {
                                  setEditedItems((previous) =>
                                    previous.map((x: any) =>
                                      x.id === item.id
                                        ? {
                                            ...x,
                                            final_order_quantity:
                                              Number(x.final_order_quantity || 0) + 1,
                                          }
                                        : x
                                    )
                                  );
                                }}
                                style={{
                                  width: 28,
                                  height: 22,
                                  border: "1px solid #2563eb",
                                  borderRadius: 5,
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  fontSize: 16,
                                  fontWeight: 900,
                                  lineHeight: 1,
                                  cursor: "pointer",
                                }}
                              >
                                +
                              </button>

                              <button
                                type="button"
                                aria-label="کاهش تعداد"
                                onClick={() => {
                                  setEditedItems((previous) =>
                                    previous.map((x: any) =>
                                      x.id === item.id
                                        ? {
                                            ...x,
                                            final_order_quantity: Math.max(
                                              0,
                                              Number(x.final_order_quantity || 0) - 1
                                            ),
                                          }
                                        : x
                                    )
                                  );
                                }}
                                style={{
                                  width: 28,
                                  height: 22,
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 5,
                                  background: "#ffffff",
                                  color: "#475569",
                                  fontSize: 16,
                                  fontWeight: 900,
                                  lineHeight: 1,
                                  cursor: "pointer",
                                }}
                              >
                                −
                              </button>
                            </div>

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={finalOrderQuantity}
                              onChange={(e) => {
                                const value = e.target.value;

                                if (value === "") {
                                  setEditedItems((previous) =>
                                    previous.map((x: any) =>
                                      x.id === item.id
                                        ? { ...x, final_order_quantity: 0 }
                                        : x
                                    )
                                  );
                                  return;
                                }

                                const number = Number(value);

                                if (!Number.isInteger(number) || number < 0) {
                                  return;
                                }

                                setEditedItems((previous) =>
                                  previous.map((x: any) =>
                                    x.id === item.id
                                      ? { ...x, final_order_quantity: number }
                                      : x
                                  )
                                );
                              }}
                              style={{
                                width: 95,
                                padding: 7,
                                fontWeight: 700,
                                border: "2px solid #2563eb",
                                background:
                                  finalOrderQuantity === 0
                                    ? "#fff1f2"
                                    : "#eff6ff",
                                textAlign: "center",
                              }}
                            />
                          </div>
                        ) : (
                          <span
                            style={{
                              fontWeight: 800,
                            }}
                          >
                            {finalOrderQuantity.toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* تعداد جزء نهایی - به صورت لایو از تعداد نهایی کارتن محاسبه می‌شود */}
                      <td>
                        {(
                          finalOrderQuantity *
                          quantityPerCarton
                        ).toLocaleString()}
                      </td>

                      <td>
                        {Number(
                          currentItem.consumer_price ||
                            0
                        ).toLocaleString()}
                      </td>

                      <td>
                        {Number(
                          currentItem.discount_percent ||
                            0
                        )}{" "}
                        %
                      </td>

                      <td>
                        {Number(
                          currentItem.final_price ||
                            0
                        ).toLocaleString()}
                      </td>

                      <td>
                        {rowTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            fontSize: 12,
            color: "#475569",
          }}
        >
          ℹ️ «تعداد اولیه سفارش (به کارتن)» مقدار ثبت‌شده توسط ویزیتور است و
          تغییر نمی‌کند. «تعداد نهایی سفارش (به کارتن)» تصمیم نهایی مدیر است.
          «تعداد جزء» نیز به‌صورت لحظه‌ای از تعداد نهایی کارتن × تعداد داخل کارتن
          محاسبه می‌شود و با تغییر تعداد نهایی فوراً تغییر می‌کند.
        </div>

        <div style={{ marginTop: 30, fontSize: 20, fontWeight: "bold" }}>
          جمع کل سفارش: {calculateGrandTotal().toLocaleString()} ریال
        </div>

        {isApproved && !isEditing && (
          <div style={{ marginTop: 20, padding: 12, borderRadius: 8, background: "#e8f5e9", border: "1px solid #a5d6a7", color: "#2e7d32" }}>
            ✅ این سفارش تأیید شده است. برای تغییر دوباره روی «اصلاح سفارش» کلیک کنید.
          </div>
        )}

        <button className="btn btn-secondary" style={{ marginTop: 30 }} onClick={() => router.back()}>
          بازگشت
        </button>
      </div>
    </AppShell>
  );
}
