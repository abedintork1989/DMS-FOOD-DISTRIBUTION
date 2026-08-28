// Warehouse version - prepared for delivery cartons and delivery documents
"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { supabase } from "@/lib/supabase";
import { closeOpenDocumentsForOrder, finalizeInvoiceDocument } from "@/lib/orderDocuments";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";

type Product = {
  id: string;
  name: string;
  barcode?: string | null;
  category?: string | null;
  image_url?: string | null;
  quantity_per_carton?: number | null;
  consumer_price?: number | null;
};

// تاریخ امروز به شمسی با فرمت YYYY/MM/DD (همان فرمتی که در دیتابیس ذخیره می‌شود)
// این تابع فقط برای نمایش/مقداردهی پیش‌فرض استفاده می‌شود؛ چیزی را در دیتابیس ذخیره نمی‌کند.
function getTodayJalaliString() {
  const today = new DateObject({ calendar: persian, locale: persian_fa });
  const yyyy = String(today.year);
  const mm = String(today.month.number).padStart(2, "0");
  const dd = String(today.day).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<any>(null);
  // نسخه ثابت فاکتور زمان تایید سفارش
  const [orderSnapshot, setOrderSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [discounts, setDiscounts] = useState<any[]>([]);

  // تاریخ تحویل سفارش (شمسی در رابط کاربری)
  const [deliveryDate, setDeliveryDate] = useState("");

  // تاریخ ارسال عملیاتی انبار.
  // این فیلد از send_date مرحله تأیید شروع می‌شود، اما بعد از آن مستقل است.
  const [warehouseSendDate, setWarehouseSendDate] = useState("");

  // تبدیل تاریخ شمسی انتخاب‌شده در انبار به تاریخ میلادی برای ذخیره در DB.
  // send_date مرحله تأیید هرگز تغییر نمی‌کند؛ فقط warehouse_send_date تغییر می‌کند.
  function jalaliToGregorian(jy: number, jm: number, jd: number) {
    jy -= 979;

    let days =
      365 * jy +
      Math.floor(jy / 33) * 8 +
      Math.floor(((jy % 33) + 3) / 4) +
      78 +
      jd +
      (jm < 7
        ? (jm - 1) * 31
        : (jm - 7) * 30 + 186);

    let gy =
      1600 +
      400 * Math.floor(days / 146097);

    days %= 146097;

    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;

      if (days >= 365) {
        days++;
      }
    }

    gy += 4 * Math.floor(days / 1461);
    days %= 1461;

    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }

    const gd = days + 1;

    const salA = [
      0,
      31,
      ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)
        ? 29
        : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];

    let gm = 0;
    let day = gd;

    while (gm < 13 && day > salA[gm]) {
      day -= salA[gm];
      gm++;
    }

    return `${gy}-${String(gm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // نمایش تاریخ تحویل:
  // چون تاریخ در دیتابیس به صورت شمسی ذخیره می‌شود (مثلاً 1405/03/03)
  // نباید با new Date() پردازش شود؛ جاوااسکریپت آن را میلادی فرض می‌کند
  // و باعث تاریخ‌های اشتباه مثل سال‌های ۷۰۰ و ۸۰۰ می‌شود.
  function formatWarehouseSendDate(value: string | null | undefined) {
    if (!value) return "-";

    const raw = String(value).trim();
    const datePart = raw.split(" ")[0];
    const slashParts = datePart.split("/");

    if (
      slashParts.length === 3 &&
      Number(slashParts[0]) >= 1300 &&
      Number(slashParts[0]) <= 1500
    ) {
      return `${slashParts[0]}/${String(slashParts[1]).padStart(2, "0")}/${String(slashParts[2]).padStart(2, "0")}`;
    }

    const date = new Date(`${datePart}T12:00:00`);
    if (Number.isNaN(date.getTime())) return raw;

    const jalali = new DateObject({
      date,
      calendar: persian,
      locale: persian_fa,
    });

    return `${jalali.year}/${String(jalali.month.number).padStart(2, "0")}/${String(jalali.day).padStart(2, "0")}`;
  }

  function normalizeDeliveryDate(value: string | null | undefined) {
    if (!value) return "";

    try {
      const clean = String(value).trim();
      const datePart = clean.split(" ")[0];

      // اگر مقدار از قبل شمسی باشد (مثلاً 1405/05/23)، همان را نگه می‌داریم.
      const slashParts = datePart.split("/");
      if (
        slashParts.length === 3 &&
        Number(slashParts[0]) >= 1300 &&
        Number(slashParts[0]) <= 1500
      ) {
        return `${slashParts[0]}/${String(slashParts[1]).padStart(2, "0")}/${String(slashParts[2]).padStart(2, "0")}`;
      }

      // اگر مقدار میلادی باشد (مثلاً 2026-08-14)، آن را به شمسی تبدیل می‌کنیم.
      const date = new Date(`${datePart}T12:00:00`);
      if (Number.isNaN(date.getTime())) return "";

      const jalali = new DateObject({
        date,
        calendar: persian,
        locale: persian_fa,
      });

      return `${jalali.year}/${String(jalali.month.number).padStart(2, "0")}/${String(jalali.day).padStart(2, "0")}`;
    } catch {
      return "";
    }
  }

  function formatPersianDate(value: string | null | undefined) {
    return normalizeDeliveryDate(value) || "-";
  }

  // تاریخ تحویل فقط تاریخ نیست؛ برای حفظ زمان ثبت، timestamp کامل نگه می‌داریم.
  // خروجی شمسی برای نمایش و ذخیره در فیلد متنی/تاریخی سفارش استفاده می‌شود.
  function formatDeliveryDate(date: any) {
    if (!date) return null;

    try {
      const now = new Date();

      // DatePicker با تقویم Persian مقدار year/month/day را شمسی برمی‌گرداند.
      const yyyy = String(date.year);
      const mm = String(date.month.number).padStart(2, "0");
      const dd = String(date.day).padStart(2, "0");

      return `${yyyy}/${mm}/${dd}`;
    } catch (error) {
      console.log("DATE FORMAT ERROR:", error);
      return null;
    }
  }

  // مستندات تحویلی انبار
  const [deliveryDocuments, setDeliveryDocuments] = useState<
    { name: string; path: string }[]
  >([]);
  const [selectedDeliveryFiles, setSelectedDeliveryFiles] = useState<File[]>([]);
  const deliveryDocumentsBucket = "delivery-documents";

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
        .select(`*, customers(name, visitor)`)
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

      // دریافت نسخه رسمی فاکتور (Snapshot)
      // این داده بعد از تایید سفارش دیگر نباید توسط انبار تغییر کند.
      const { data: snapshotData, error: snapshotError } = await supabase
        .from("order_snapshots")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (snapshotError) {
        console.log("SNAPSHOT LOAD ERROR:", snapshotError);
      }

      setOrderSnapshot(snapshotData || null);

      const finalData = {
        ...orderData,
        order_items: items || [],
        order_snapshot: snapshotData || null,
      };
      setOrder(finalData);

      // مقدار تاریخ ذخیره شده را برای نمایش مجدد در DatePicker برمی‌گردانیم.
      // اگر سفارش هنوز تاریخ تحویلی ندارد، پیش‌فرض روی تاریخ امروز قرار می‌گیرد
      // (فقط برای نمایش؛ تا زمانی که «ذخیره تغییرات» زده نشود چیزی در دیتابیس ثبت نمی‌شود).
      setDeliveryDate(normalizeDeliveryDate(orderData.delivery_date) || getTodayJalaliString());

      const originalWarehouseSendDate =
        orderData.warehouse_send_date || orderData.send_date || null;

      if (originalWarehouseSendDate) {
        const raw = String(originalWarehouseSendDate).trim();
        const parts = raw.split(" ")[0].split("/");
        if (
          parts.length === 3 &&
          Number(parts[0]) >= 1300 &&
          Number(parts[0]) <= 1500
        ) {
          setWarehouseSendDate(
            `${parts[0]}/${String(parts[1]).padStart(2, "0")}/${String(parts[2]).padStart(2, "0")}`
          );
        } else {
          const date = new Date(`${raw.substring(0, 10)}T12:00:00`);
          if (!Number.isNaN(date.getTime())) {
            const jalali = new DateObject({
              date,
              calendar: persian,
              locale: persian_fa,
            });
            setWarehouseSendDate(
              `${jalali.year}/${String(jalali.month.number).padStart(2, "0")}/${String(jalali.day).padStart(2, "0")}`
            );
          } else {
            setWarehouseSendDate("");
          }
        }
      } else {
        setWarehouseSendDate("");
      }

      setEditedItems(finalData.order_items || []);
      await loadDeliveryDocuments();

      if (orderData.customer_id) {
        const { data: discountData, error: discountError } = await supabase
          .from("customer_group_discounts")
          .select("category,discount_percent")
          .eq("customer_id", orderData.customer_id);

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

  async function loadDeliveryDocuments() {
    if (!id) return;

    const { data, error } = await supabase.storage
      .from(deliveryDocumentsBucket)
      .list(id, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      console.log("DELIVERY DOCUMENTS LIST ERROR:", error);
      setDeliveryDocuments([]);
      return;
    }

    setDeliveryDocuments(
      (data || [])
        .filter((file: any) => file.name)
        .map((file: any) => ({
          name: file.name,
          path: `${id}/${file.name}`,
        }))
    );
  }

  function handleDeliveryFilesChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);
    const allowed = files.filter(
      (file) =>
        file.type === "application/pdf" ||
        file.type.startsWith("image/")
    );

    if (allowed.length !== files.length) {
      alert("فقط فایل PDF و تصویر قابل انتخاب است.");
    }

    setSelectedDeliveryFiles((previous) => [...previous, ...allowed]);
    event.target.value = "";
  }

  async function openDeliveryDocument(path: string) {
    const { data, error } = await supabase.storage
      .from(deliveryDocumentsBucket)
      .createSignedUrl(path, 60 * 10);

    if (error || !data?.signedUrl) {
      console.log("DELIVERY DOCUMENT OPEN ERROR:", error);
      alert(`خطا در باز کردن مستند: ${error?.message || "لینک فایل ساخته نشد."}`);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function uploadDeliveryDocuments() {
    if (!selectedDeliveryFiles.length) return true;

    for (const file of selectedDeliveryFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${id}/${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from(deliveryDocumentsBucket)
        .upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });

      if (error) {
        console.log("DELIVERY DOCUMENT UPLOAD ERROR:", error);
        alert(`خطا در ذخیره مستند «${file.name}»: ${error.message}`);
        return false;
      }
    }

    setSelectedDeliveryFiles([]);
    await loadDeliveryDocuments();
    return true;
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

  // نسخه رسمی فاکتور فقط از Snapshot خوانده می‌شود.
  // اطلاعات عملیاتی انبار همچنان از order_items می‌آید.
  function getSnapshotItems() {
    return Array.isArray(orderSnapshot?.items)
      ? orderSnapshot.items
      : [];
  }

  function getSnapshotItem(item: any) {
    const productId = item?.product_id;
    if (!productId) return null;

    return (
      getSnapshotItems().find(
        (snapshotItem: any) =>
          String(snapshotItem?.product_id) === String(productId)
      ) || null
    );
  }

  function getConfirmedOrderCartons(item: any) {
    const snapshotItem = getSnapshotItem(item);

    if (snapshotItem) {
      const value = snapshotItem.final_order_quantity;
      if (value !== null && value !== undefined && value !== "") {
        return Math.max(0, Math.floor(Number(value)));
      }

      const product = item?.products || {};
      const cartonSize = Math.max(
        Number(product.quantity_per_carton || 1),
        1
      );
      return Math.ceil(Number(snapshotItem.quantity || 0) / cartonSize);
    }

    return getFinalOrderQuantity(item);
  }

  function getConfirmedPrice(item: any) {
    const snapshotItem = getSnapshotItem(item);
    if (snapshotItem) return Number(snapshotItem.final_price || 0);
    return Number(item?.final_price || 0);
  }

  function getConfirmedConsumerPrice(item: any) {
    const snapshotItem = getSnapshotItem(item);
    if (snapshotItem) return Number(snapshotItem.consumer_price || 0);
    return Number(item?.consumer_price || 0);
  }

  function getConfirmedDiscount(item: any) {
    const snapshotItem = getSnapshotItem(item);
    if (snapshotItem) return Number(snapshotItem.discount_percent || 0);
    return Number(item?.discount_percent || 0);
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

  // تعداد تحویلی انبار فقط از فیلدهای عملیاتی order_items می‌آید.
  function getDeliveryCartons(item: any) {
    const currentItem = getCurrentItem(item);
    const value = currentItem.delivery_cartons;

    if (value !== null && value !== undefined && value !== "") {
      return Math.max(0, Math.floor(Number(value)));
    }

    return getConfirmedOrderCartons(currentItem);
  }

  function calculateRowTotal(item: any) {
    const currentItem = getCurrentItem(item);
    const product = currentItem.products || {};
    const cartonSize = Math.max(
      Number(product.quantity_per_carton || 1),
      1
    );

    const deliveryUnits =
      currentItem.delivery_units !== undefined &&
      currentItem.delivery_units !== null
        ? Number(currentItem.delivery_units)
        : getDeliveryCartons(currentItem) * cartonSize;

    return deliveryUnits * getConfirmedPrice(currentItem);
  }

  // مبلغ رسمی سفارش در لحظه تأیید؛ هرگز از داده‌های انبار محاسبه نمی‌شود.
  function calculateConfirmedGrandTotal() {
    if (orderSnapshot?.invoice_total !== null && orderSnapshot?.invoice_total !== undefined) {
      return Number(orderSnapshot.invoice_total || 0);
    }

    return getSnapshotItems().reduce(
      (sum: number, item: any) =>
        sum + Number(item.total_purchase_price || 0),
      0
    );
  }

  // مبلغ واقعی تحویل‌شده توسط انبار.
  function calculateGrandTotal() {
    return editedItems.reduce(
      (sum: number, item: any) =>
        sum + calculateRowTotal(item),
      0
    );
  }

  function startEditing() {
    const itemsWithDeliveryDefault = (order.order_items || []).map(
      (item: any) => ({
        ...item,
        delivery_cartons:
          item.delivery_cartons ??
          getConfirmedOrderCartons(item),
      })
    );

    setEditedItems(itemsWithDeliveryDefault);
    setIsEditing(true);

    // اگر تاریخ تحویل هنوز ثبت نشده، به‌صورت پیش‌فرض روی امروز قرار می‌گیرد
    // تا مسئول انبار مجبور به انتخاب دستی تاریخ امروز نباشد.
    if (!deliveryDate) {
      setDeliveryDate(getTodayJalaliString());
    }

    if (!warehouseSendDate) {
      const original = order.warehouse_send_date || order.send_date || "";
      const raw = String(original).trim();
      const parts = raw.split(" ")[0].split("/");

      if (
        parts.length === 3 &&
        Number(parts[0]) >= 1300 &&
        Number(parts[0]) <= 1500
      ) {
        setWarehouseSendDate(
          `${parts[0]}/${String(parts[1]).padStart(2, "0")}/${String(parts[2]).padStart(2, "0")}`
        );
      } else if (raw) {
        const date = new Date(`${raw.substring(0, 10)}T12:00:00`);
        if (!Number.isNaN(date.getTime())) {
          const jalali = new DateObject({
            date,
            calendar: persian,
            locale: persian_fa,
          });
          setWarehouseSendDate(
            `${jalali.year}/${String(jalali.month.number).padStart(2, "0")}/${String(jalali.day).padStart(2, "0")}`
          );
        }
      }
    }
  }

  function cancelEditing() {
    setEditedItems(order.order_items || []);
    setIsEditing(false);
    setShowAddProduct(false);
    setSelectedProductIds({});
    setPendingCartons({});
    // در صورت لغو ویرایش، تاریخ نمایشی به آخرین مقدار ذخیره‌شده (یا امروز) برمی‌گردد.
    setDeliveryDate(normalizeDeliveryDate(order.delivery_date) || getTodayJalaliString());

    const originalWarehouseSendDate =
      order.warehouse_send_date || order.send_date || "";

    const rawWarehouseSendDate = String(originalWarehouseSendDate).trim();
    const warehouseParts =
      rawWarehouseSendDate.split(" ")[0].split("/");

    if (
      warehouseParts.length === 3 &&
      Number(warehouseParts[0]) >= 1300 &&
      Number(warehouseParts[0]) <= 1500
    ) {
      setWarehouseSendDate(
        `${warehouseParts[0]}/${String(warehouseParts[1]).padStart(2, "0")}/${String(warehouseParts[2]).padStart(2, "0")}`
      );
    } else if (rawWarehouseSendDate) {
      const date = new Date(
        `${rawWarehouseSendDate.substring(0, 10)}T12:00:00`
      );

      if (!Number.isNaN(date.getTime())) {
        const jalali = new DateObject({
          date,
          calendar: persian,
          locale: persian_fa,
        });

        setWarehouseSendDate(
          `${jalali.year}/${String(jalali.month.number).padStart(2, "0")}/${String(jalali.day).padStart(2, "0")}`
        );
      } else {
        setWarehouseSendDate("");
      }
    } else {
      setWarehouseSendDate("");
    }
  }

  function openAddProduct() {
    setProductSearch("");
    setSelectedProductIds({});
    setPendingCartons({});
    setShowAddProduct(true);
    loadProducts();
  }

  function getDiscountForCategory(category: string | null | undefined) {
    // تخفیف کالای جدید را از همان تخفیف ثبت‌شده برای کالاهای فعلی سفارش می‌گیریم.
    // اگر در سفارش تخفیف ذخیره نشده باشد، صفر در نظر گرفته می‌شود.
    const existing = editedItems.find(
      (item: any) =>
        (item.products?.category || "").trim() === (category || "").trim()
    );
    return Number(existing?.discount_percent || 0);
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

  async function cancelOrder() {
    if (order.status !== "approved" && order.status !== "delivered") {
      alert("این سفارش در این مرحله قابل ابطال نیست.");
      return;
    }

    const statusLabel =
      order.status === "approved"
        ? "در حال ارسال"
        : "تحویل داده شد";

    if (
      !confirm(
        `سفارش از مرحله «${statusLabel}» ابطال شود؟\n\nسفارش حذف نمی‌شود و با وضعیت «ابطال (${statusLabel})» باقی می‌ماند.`
      )
    ) {
      return;
    }

    const cancelledAt = new Date().toISOString();

    const { error } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        cancelled_from: order.status,
        cancelled_at: cancelledAt,
      })
      .eq("id", id)
      .eq("status", order.status);

    if (error) {
      console.log("CANCEL ORDER ERROR:", error);
      alert(`خطا در ابطال سفارش: ${error.message}`);
      return;
    }

    await closeOpenDocumentsForOrder(id);

    setIsEditing(false);
    setSelectedProductIds({});
    setPendingCartons({});
    setShowAddProduct(false);

    setOrder({
      ...order,
      status: "cancelled",
      cancelled_from: order.status,
      cancelled_at: cancelledAt,
    });
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

    if (value === "delivered" || value === "تحویل داده شد") {
      return "تحویل داده شد";
    }

    if (value === "approved" || value === "در حال ارسال") {
      return "در حال ارسال";
    }

    if (value === "rejected" || value === "رد شده") {
      return "رد شده";
    }

    return status || "-";
  }

  async function saveWarehouseChanges() {
    if (saving) return;

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

        // بعد از تأیید، تعداد و قیمت سفارش رسمی فقط از Snapshot می‌آیند.
        // انبار اجازه تغییر این اطلاعات را ندارد و فقط اطلاعات تحویل را ثبت می‌کند.
        const confirmedCartons = getConfirmedOrderCartons(item);

        const deliveryCartons = Math.max(
          0,
          Math.floor(
            Number(item.delivery_cartons ?? confirmedCartons)
          )
        );

        // اگر «تعداد جزء» دستی ویرایش شده باشد، همان مقدار ملاک جمع
        // ردیف است؛ در غیر این صورت از کارتن × تعداد داخل کارتن محاسبه می‌شود.
        const deliveryUnits =
          item.delivery_units !== undefined &&
          item.delivery_units !== null &&
          item.delivery_units !== ""
            ? Math.max(0, Number(item.delivery_units))
            : deliveryCartons * cartonSize;

        const consumerPrice = getConfirmedConsumerPrice(item);
        const discountPercent = getConfirmedDiscount(item);
        const finalPrice = getConfirmedPrice(item);

        const total = deliveryUnits * finalPrice;

        // ابتدا فقط UPDATE را انجام می‌دهیم.
        // نتیجه UPDATE را با SELECT مخلوط نمی‌کنیم تا RLS/RETURNING
        // باعث تشخیص اشتباه نشود.
        const { error: updateItemError } =
          await supabase
            .from("order_items")
            .update({
              // سفارش رسمی قفل است؛ فقط اطلاعات عملیاتی تحویل انبار تغییر می‌کنند.
              delivery_cartons:
                deliveryCartons,
              delivery_units:
                item.delivery_units !== undefined &&
                item.delivery_units !== null &&
                item.delivery_units !== ""
                  ? Number(item.delivery_units)
                  : null,
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
          .select("id, delivery_cartons, delivery_units")
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
          Number(savedItem.delivery_cartons ?? 0) !==
          deliveryCartons
        ) {
          alert(
            `تعداد تحویلی ذخیره نشد.

شناسه کالا: ${item.id}
مقدار موردنظر: ${deliveryCartons}
مقدار موجود در دیتابیس: ${savedItem.delivery_cartons ?? 0}

Policy مربوط به UPDATE/SELECT ستون delivery_cartons در جدول order_items را بررسی کنید.`
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

          const deliveryUnits =
            item.delivery_units !== undefined &&
            item.delivery_units !== null &&
            item.delivery_units !== ""
              ? Math.max(0, Number(item.delivery_units))
              : finalOrderQuantity * cartonSize;

          return {
            order_id: id,
            product_id: item.product_id,
            // کالای جدید توسط ویزیتور ثبت نشده است؛ بنابراین تعداد اولیه = صفر.
            quantity: 0,
            final_order_quantity:
              finalOrderQuantity,
            delivery_cartons:
              finalOrderQuantity,
            delivery_units:
              item.delivery_units !== undefined &&
              item.delivery_units !== null &&
              item.delivery_units !== ""
                ? Number(item.delivery_units)
                : null,
            consumer_price: Number(
              item.consumer_price || 0
            ),
            discount_percent: Number(
              item.discount_percent || 0
            ),
            purchase_price:
              finalPrice,
            total_purchase_price:
              deliveryUnits * finalPrice,
            final_price:
              finalPrice,
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

      // تاریخ تحویل: اگر کاربر چیزی انتخاب نکرده، همان تاریخ امروز (که به‌صورت
      // پیش‌فرض در فیلد قرار گرفته) به‌عنوان مقدار نهایی ذخیره می‌شود.
      const deliveryDateToSave =
        deliveryDate || getTodayJalaliString();

      const warehouseSendDateToSave =
        warehouseSendDate
          ? (() => {
              const parts = warehouseSendDate.split("/");
              if (parts.length !== 3) return null;

              return jalaliToGregorian(
                Number(parts[0]),
                Number(parts[1]),
                Number(parts[2])
              );
            })()
          : null;

      const { error: orderUpdateError } =
        await supabase
          .from("orders")
          .update({
            status: order.status,
            invoice_total: grandTotal,
            delivery_date: deliveryDateToSave,
            warehouse_send_date: warehouseSendDateToSave,
          })
          .eq("id", id);

      if (orderUpdateError) {
        console.log(
          "ORDER UPDATE ERROR:",
          orderUpdateError
        );

        alert(
          `خطا در ذخیره تغییرات سفارش: ${orderUpdateError.message}`
        );

        setSaving(false);
        return;
      }

      const {
        data: savedOrder,
        error: verifyOrderError,
      } = await supabase
        .from("orders")
        .select(
          "id, status, invoice_total, delivery_date, send_date, warehouse_send_date"
        )
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
        String(order.status).toLowerCase()
      ) {
        alert(
          `تغییرات ذخیره شد اما وضعیت سفارش تغییر کرده است. وضعیت فعلی: ${savedOrder.status}`
        );
        setSaving(false);
        return;
      }

      const documentsUploaded = await uploadDeliveryDocuments();

      if (!documentsUploaded) {
        setSaving(false);
        return;
      }

      // تاریخ ذخیره شده را در همان صفحه هم نمایش بده
      setOrder((previous: any) => ({
        ...previous,
        delivery_date: savedOrder.delivery_date,
        warehouse_send_date: savedOrder.warehouse_send_date,
      }));

      setDeliveryDate(normalizeDeliveryDate(savedOrder.delivery_date) || getTodayJalaliString());

      if (savedOrder.warehouse_send_date) {
        const savedWarehouseSendDate = String(
          savedOrder.warehouse_send_date
        ).substring(0, 10);

        const date = new Date(`${savedWarehouseSendDate}T12:00:00`);

        if (!Number.isNaN(date.getTime())) {
          const jalali = new DateObject({
            date,
            calendar: persian,
            locale: persian_fa,
          });

          setWarehouseSendDate(
            `${jalali.year}/${String(jalali.month.number).padStart(2, "0")}/${String(jalali.day).padStart(2, "0")}`
          );
        }
      }

      alert(
        "تغییرات سفارش و مستندات تحویلی با موفقیت ذخیره شد."
      );

      setSelectedProductIds({});
      setPendingCartons({});
      setShowAddProduct(false);

      setIsEditing(false);
      await loadOrder();
    } catch (error) {
      console.log(
        "WAREHOUSE SAVE ERROR:",
        error
      );
      alert(
        "خطایی هنگام ذخیره سفارش رخ داد."
      );
    }

    setSaving(false);
  }

  async function markAsDelivered() {
    if (saving) return;

    if (!confirm("آیا این سفارش تحویل داده شده است؟")) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "delivered" })
        .eq("id", id);

      if (error) {
        console.log("DELIVER ERROR:", error);
        alert(`خطا در ثبت تحویل سفارش: ${error.message}`);
        return;
      }

      await finalizeInvoiceDocument(id, {
        invoiceTotal: Number(order.invoice_total || 0),
        sendDate: order.warehouse_send_date || order.send_date || null,
        deliveryDate: order.delivery_date || null,
      });

      alert("وضعیت سفارش با موفقیت به «تحویل داده شد» تغییر کرد.");
      await loadOrder();
    } finally {
      setSaving(false);
    }
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

  const isWarehouseActive = order.status === "approved" || order.status === "delivered";

  return (
    <AppShell>
      <PageHeader
        title={`انبار - سفارش ${order.order_number || ""}`}
        subtitle="مدیریت، ویرایش و تحویل سفارش در انبار"
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
          <div><strong>مشتری:</strong><br />{order.customers?.name || "-"}</div>
          <div><strong>ویزیتور:</strong><br />{order.customers?.visitor || "-"}</div>
          <div><strong>وضعیت:</strong><br />{order.status === "approved" ? "تأیید شده" : order.status}</div>
          <div><strong>تاریخ ثبت:</strong><br />{new Date(order.created_at).toLocaleDateString("fa-IR")}</div>
          <div>
            <strong>تاریخ ارسال سفارش:</strong><br />
            {isEditing ? (
              <div
                style={{
                  marginTop: 6,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  color: "#475569",
                  fontWeight: 700,
                  cursor: "not-allowed",
                  opacity: 0.9,
                }}
                title="تاریخ ارسال پس از ورود به انبار قابل تغییر نیست."
              >
                🔒 {formatWarehouseSendDate(
                  order.warehouse_send_date || order.send_date || null
                )}
              </div>
            ) : (
              formatWarehouseSendDate(
                order.warehouse_send_date ||
                  order.send_date ||
                  null
              )
            )}
          </div>

          {isEditing && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "#ecfdf5",
                border: "2px solid #22c55e",
                boxShadow: "0 4px 12px rgba(34, 197, 94, 0.12)",
              }}
            >
              <strong style={{ color: "#166534", display: "block", marginBottom: 6 }}>
                تاریخ تحویل
              </strong>
              <DatePicker
                calendar={persian}
                locale={persian_fa}
                format="YYYY/MM/DD"
                value={deliveryDate || ""}
                onChange={(date: any) => {
                  const formatted = formatDeliveryDate(date);
                  setDeliveryDate(formatted || "");
                }}
                calendarPosition="bottom-right"
                inputClass="input"
                editable={false}
                placeholder="انتخاب تاریخ تحویل"
              />
            </div>
          )}

          {!isEditing && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "#ecfdf5",
                border: "2px solid #22c55e",
              }}
            >
              <strong style={{ color: "#166534", display: "block", marginBottom: 6 }}>
                تاریخ تحویل
              </strong>
              {formatPersianDate(order.delivery_date || getTodayJalaliString())}
            </div>
          )}
        </div>

        <hr style={{ margin: "30px 0" }} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {order.status === "approved" && !isEditing && (
            <button
              className="btn btn-secondary"
              onClick={startEditing}
              disabled={saving}
            >
              ✏️ ویرایش سفارش
            </button>
          )}

          {order.status === "approved" && (
            <button
              className="btn btn-primary"
              onClick={markAsDelivered}
              disabled={saving || isEditing}
            >
              🚚 تحویل داده شد
            </button>
          )}

          {(order.status === "approved" || order.status === "delivered") && (
            <button
              className="btn btn-danger"
              onClick={cancelOrder}
              disabled={saving}
            >
              ✕ ابطال سفارش
            </button>
          )}

          {isEditing && (
            <>
              <button className="btn btn-primary" onClick={saveWarehouseChanges} disabled={saving}>
                {saving ? "در حال ثبت..." : "✅ ذخیره تغییرات"}
              </button>

              <button className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>
                لغو ویرایش
              </button>
            </>
          )}
        </div>

        {/* مستندات تحویلی */}
        <div
          style={{
            marginBottom: 20,
            padding: 14,
            borderRadius: 10,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input
              id="delivery-documents-input"
              type="file"
              accept="application/pdf,image/*"
              multiple
              onChange={handleDeliveryFilesChange}
              style={{ display: "none" }}
            />

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => document.getElementById("delivery-documents-input")?.click()}
              disabled={saving}
            >
              📎 مستندات تحویلی
            </button>

            {selectedDeliveryFiles.length > 0 && (
              <span style={{ fontSize: 13, color: "#475569" }}>
                {selectedDeliveryFiles.length.toLocaleString("fa-IR")} فایل آماده ذخیره است.
              </span>
            )}
          </div>

          {(deliveryDocuments.length > 0 || selectedDeliveryFiles.length > 0) && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
              {deliveryDocuments.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => openDeliveryDocument(file.path)}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    textAlign: "right",
                    cursor: "pointer",
                    color: "#2563eb",
                    fontWeight: 700,
                  }}
                >
                  📄 {file.name}
                </button>
              ))}

              {selectedDeliveryFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} style={{ color: "#64748b", fontSize: 13 }}>
                  ⏳ {file.name} — پس از «ذخیره تغییرات» آپلود می‌شود.
                </div>
              ))}
            </div>
          )}
        </div>

        {isEditing && (
          <div style={{ marginBottom: 20, padding: 12, borderRadius: 8, background: "#fff8e1", border: "1px solid #f0d98c" }}>
            <strong>حالت ویرایش فعال است</strong>
            <div style={{ marginTop: 5, fontSize: 14 }}>
              می‌توانید تاریخ تحویل، تعداد تحویلی و مقادیر مربوط به تحویل سفارش را اصلاح کنید.
            </div>
          </div>
        )}

        {/* مودال افزودن چند کالای جدید */}
        {showAddProduct && (
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
                                <input
                                  className="input"
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={
                                    pendingCartons[
                                      product.id
                                    ] || ""
                                  }
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    changePendingCartons(
                                      product.id,
                                      e.target.value
                                    );
                                  }}
                                  onClick={(e) =>
                                    e.stopPropagation()
                                  }
                                  placeholder="تعداد"
                                  style={{
                                    width: 100,
                                    padding: 7,
                                    fontWeight: 700,
                                    border:
                                      "2px solid #f97316",
                                    background:
                                      "#fff7ed",
                                  }}
                                />
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

        {orderSnapshot?.items && (
          <div
            style={{
              marginBottom: 20,
              padding: 12,
              borderRadius: 10,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
            }}
          >
            🔒 نسخه رسمی فاکتور زمان تایید ثبت شده است.
            <br />
            مقدار سفارش مشتری از Snapshot خوانده می‌شود و تغییرات انبار نباید آن را تغییر دهد.
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
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>تعداد تحویلی (کارتن)</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>کسری فروش (کارتن)</th>
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
                    (() => {
                      const snapshotItem = getSnapshotItem(currentItem);
                      if (!snapshotItem) return getOriginalCartons(currentItem);
                      return Math.ceil(
                        Number(snapshotItem.quantity || 0) / quantityPerCarton
                      );
                    })();

                  const finalOrderQuantity =
                    getConfirmedOrderCartons(currentItem);

                  const deliveryCartons =
                    getDeliveryCartons(currentItem);

                  const shortageCartons = Math.max(
                    0,
                    finalOrderQuantity - deliveryCartons
                  );

                  const rowTotal =
                    calculateRowTotal(currentItem);

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

                      {/* تعداد نهایی سفارش - فقط نمایشی و قفل */}
                      <td>
                        <span
                          style={{
                            fontWeight: 800,
                          }}
                        >
                          {finalOrderQuantity.toLocaleString()}
                        </span>
                      </td>

                      {/* تعداد تحویلی انبار */}
                      <td>
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={getDeliveryCartons(currentItem)}
                            readOnly
                            disabled
                            style={{
                              width: 95,
                              padding: 7,
                              fontWeight: 700,
                              border: "2px solid #94a3b8",
                              background: "#e2e8f0",
                              cursor: "not-allowed",
                            }}
                          />
                        ) : (
                          <span style={{ fontWeight: 800 }}>
                            {getDeliveryCartons(currentItem).toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* کسری فروش: سفارش رسمی منهای تحویل واقعی */}
                      <td>
                        <span
                          style={{
                            fontWeight: 800,
                            color: shortageCartons > 0 ? "#dc2626" : "#166534",
                          }}
                        >
                          {shortageCartons.toLocaleString()}
                        </span>
                      </td>

                      {/* تعداد جزء */}
                      <td>
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            className="input"
                            value={
                              currentItem.delivery_units ??
                              getDeliveryCartons(currentItem) * quantityPerCarton
                            }
                            onChange={(e) => {
                              const value = Number(e.target.value || 0);
                              setEditedItems((previous) =>
                                previous.map((x: any) =>
                                  x.id === item.id
                                    ? { ...x, delivery_units: value }
                                    : x
                                )
                              );
                            }}
                            style={{ width: 100 }}
                          />
                        ) : (
                          (
                            currentItem.delivery_units ??
                            getDeliveryCartons(currentItem) * quantityPerCarton
                          ).toLocaleString()
                        )}
                      </td>

                      <td>
                        {getConfirmedConsumerPrice(currentItem).toLocaleString()}
                      </td>

                      <td>
                        {getConfirmedDiscount(currentItem)}{" "}
                        %
                      </td>

                      <td>
                        {getConfirmedPrice(currentItem).toLocaleString()}
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
          🔒 تعداد اولیه و تعداد نهایی سفارش از نسخه رسمی فاکتور زمان تأیید خوانده می‌شوند و
          با تغییرات انبار تغییر نمی‌کنند. «تعداد تحویلی» مقدار واقعی تحویل انبار است و
          «کسری فروش» اختلاف سفارش تأییدشده با مقدار تحویل‌شده است.
        </div>

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ padding: 14, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            <div style={{ fontSize: 12, color: "#475569" }}>مبلغ سفارش تأییدشده</div>
            <div style={{ marginTop: 5, fontSize: 18, fontWeight: 800 }}>
              {calculateConfirmedGrandTotal().toLocaleString()} ریال
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <div style={{ fontSize: 12, color: "#475569" }}>مبلغ تحویل‌شده</div>
            <div style={{ marginTop: 5, fontSize: 18, fontWeight: 800 }}>
              {calculateGrandTotal().toLocaleString()} ریال
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa" }}>
            <div style={{ fontSize: 12, color: "#475569" }}>فروش از دست‌رفته</div>
            <div style={{ marginTop: 5, fontSize: 18, fontWeight: 800, color: "#c2410c" }}>
              {Math.max(0, calculateConfirmedGrandTotal() - calculateGrandTotal()).toLocaleString()} ریال
            </div>
          </div>
        </div>

        {!isEditing && order.status === "delivered" && (
          <div style={{ marginTop: 20, padding: 12, borderRadius: 8, background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569" }}>
            🔒 این سفارش تحویل داده شده است و دیگر قابل ویرایش نیست.
          </div>
        )}

        <button className="btn btn-secondary" style={{ marginTop: 30 }} onClick={() => router.back()}>
          بازگشت
        </button>
      </div>
    </AppShell>
  );
}
