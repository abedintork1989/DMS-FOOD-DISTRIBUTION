"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, Save, Trash2, Paperclip } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";

type PaymentType = "cash" | "bank_transfer" | "pos" | "check";

type Customer = {
  id: string;
  name: string;
  province?: string | null;
};

type PaymentRecord = {
  id: string;
  payment_number?: number | null;
  attachment_urls?: string[];
  amount: number;
  payment_date: string | null;
  payment_type: PaymentType;
  description: string | null;
  bank_name: string | null;
  destination_account: string | null;
  tracking_code: string | null;
  terminal_number: string | null;
  pos_tracking_code: string | null;
  check_number: string | null;
  sayadi_number: string | null;
  check_issue_date: string | null;
  check_due_date: string | null;
  check_status: string | null;
};

type LedgerRow = {
  id: string;
  documentType: "سفارش" | "سند پرداختی" | "مارکتینگ";
  documentNumber: string;
  description?: string | null;
  amount: number;
  date: string | null;
  paymentType?: PaymentType;
  payment?: PaymentRecord;
};

const paymentLabels: Record<PaymentType, string> = {
  cash: "نقدی",
  bank_transfer: "واریز بانکی",
  pos: "پوز",
  check: "چک",
};

const CHECK_STATUS_META: Record<
  string,
  { label: string; background: string; color: string }
> = {
  not_due: {
    label: "عدم سررسید",
    background: "#fef3c7",
    color: "#92400e",
  },
  due: {
    label: "سررسید",
    background: "#fee2e2",
    color: "#b91c1c",
  },
  cleared: {
    label: "وصول",
    background: "#dcfce7",
    color: "#166534",
  },
  received: {
    label: "عدم سررسید",
    background: "#fef3c7",
    color: "#92400e",
  },
  returned: {
    label: "سررسید",
    background: "#fee2e2",
    color: "#b91c1c",
  },
};

function normalizedCheckStatus(status: string | null | undefined) {
  if (status === "cleared") return "cleared";
  if (status === "due" || status === "returned") return "due";
  return "not_due";
}

function getCheckStatusMeta(status: string | null | undefined) {
  return (
    CHECK_STATUS_META[normalizedCheckStatus(status)] ||
    CHECK_STATUS_META.not_due
  );
}

function money(value: number) {
  return `${new Intl.NumberFormat("fa-IR").format(
    Math.abs(Number(value || 0))
  )} ریال`;
}

function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

function gregorianToJalali(gy: number, gm: number, gd: number) {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

  let jy = gy > 1600 ? 979 : 0;
  gy = gy > 1600 ? gy - 1600 : gy - 621;

  const gy2 = gm > 2 ? gy + 1 : gy;

  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    gdm[gm - 1];

  jy += 33 * Math.floor(days / 12053);
  days %= 12053;

  jy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const jm =
    days < 186
      ? 1 + Math.floor(days / 31)
      : 7 + Math.floor((days - 186) / 30);

  const jd =
    1 + (days < 186 ? days % 31 : (days - 186) % 30);

  return { jy, jm, jd };
}

function jalaliToGregorian(jy: number, jm: number, jd: number) {
  let gy = jy > 979 ? 1600 : 621;
  jy = jy > 979 ? jy - 979 : jy;

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

  const isLeap =
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;

  const salA = [
    0,
    31,
    isLeap ? 29 : 28,
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

  let gm = 1;

  for (gm = 1; gm <= 12; gm++) {
    if (gd <= salA[gm]) break;
    gd -= salA[gm];
  }

  return { gy, gm, gd };
}

function jalaliDaysInMonth(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;

  const isLeap =
    ((((jy - (jy > 0 ? 474 : 473)) % 2820) + 474 + 38) * 682) %
      2816 <
    682;

  return isLeap ? 30 : 29;
}

function getCurrentJalali() {
  const now = new Date();

  return gregorianToJalali(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );
}

function gregorianStringToJalali(value: string) {
  const [gy, gm, gd] = value
    .substring(0, 10)
    .split("-")
    .map(Number);

  if (!gy || !gm || !gd) return getCurrentJalali();

  return gregorianToJalali(gy, gm, gd);
}

function jalaliPartsToGregorianString(
  jy: number,
  jm: number,
  jd: number
) {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);

  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(
    2,
    "0"
  )}`;
}

function faDate(value: string | null) {
  if (!value) return "-";

  const { jy, jm, jd } = gregorianStringToJalali(value);

  return `${toPersianDigits(jy)}/${toPersianDigits(
    String(jm).padStart(2, "0")
  )}/${toPersianDigits(String(jd).padStart(2, "0"))}`;
}

function dateValueToJalali(value: string | null) {
  return value ? gregorianStringToJalali(value) : getCurrentJalali();
}

function normalizeNumber(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[^0-9]/g, "");
}

function formatInputMoney(value: string) {
  const number = normalizeNumber(value);
  if (!number) return "";

  return Number(number).toLocaleString("fa-IR");
}

function JalaliDateInput({
  label,
  value,
  onChange,
  minYear,
  maxYear,
}: {
  label: string;
  value: string;
  onChange: (gregorianDate: string) => void;
  minYear: number;
  maxYear: number;
}) {
  const current = dateValueToJalali(value);

  function update(part: "year" | "month" | "day", rawValue: string) {
    let year = current.jy;
    let month = current.jm;
    let day = current.jd;

    const numeric = Number(rawValue);

    if (part === "year") year = numeric;
    if (part === "month") month = numeric;
    if (part === "day") day = numeric;

    const maxDay = jalaliDaysInMonth(year, month);
    if (day > maxDay) day = maxDay;

    onChange(jalaliPartsToGregorianString(year, month, day));
  }

  const years = Array.from(
    { length: maxYear - minYear + 1 },
    (_, index) => minYear + index
  );

  return (
    <div className="form-field">
      <label>{label}</label>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.4fr 1fr",
          gap: 8,
        }}
      >
        <select
          className="select"
          value={current.jd}
          onChange={(event) => update("day", event.target.value)}
        >
          {Array.from(
            { length: jalaliDaysInMonth(current.jy, current.jm) },
            (_, index) => index + 1
          ).map((day) => (
            <option key={day} value={day}>
              {toPersianDigits(day)}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={current.jm}
          onChange={(event) => update("month", event.target.value)}
        >
          {JALALI_MONTHS.map((monthName, index) => (
            <option key={monthName} value={index + 1}>
              {monthName}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={current.jy}
          onChange={(event) => update("year", event.target.value)}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {toPersianDigits(year)}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          color: "#64748b",
        }}
      >
        {toPersianDigits(current.jy)}/
        {toPersianDigits(String(current.jm).padStart(2, "0"))}/
        {toPersianDigits(String(current.jd).padStart(2, "0"))}
      </div>
    </div>
  );
}

export default function CustomerFinancePage() {
  const params = useParams();
  const router = useRouter();

  // IMPORTANT:
  // This route is src/app/finance/[id]/page.tsx,
  // therefore the dynamic parameter is "id".
  const customerId = String(params?.id ?? "");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentJalali = useMemo(() => getCurrentJalali(), []);

  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => {
    const today = new Date();

    return `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [description, setDescription] = useState("");

  const [bankName, setBankName] = useState("");
  const [destinationAccount, setDestinationAccount] = useState("");
  const [trackingCode, setTrackingCode] = useState("");

  const [terminalNumber, setTerminalNumber] = useState("");
  const [posTrackingCode, setPosTrackingCode] = useState("");

  const [checkNumber, setCheckNumber] = useState("");
  const [sayadiNumber, setSayadiNumber] = useState("");
  const [checkIssueDate, setCheckIssueDate] = useState("");
  const [checkDueDate, setCheckDueDate] = useState("");
  const [checkStatus, setCheckStatus] = useState("not_due");

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  const [paymentFiles, setPaymentFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);

  const [filters, setFilters] = useState({
    documentType: "",
    paymentType: "",
    amount: "",
    date: "",
    checkStatus: "",
  });

  function setFilter(key: keyof typeof filters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function clearFilters() {
    setFilters({
      documentType: "",
      paymentType: "",
      amount: "",
      date: "",
      checkStatus: "",
    });
  }

  useEffect(() => {
    if (customerId) {
      loadFinance();
    }
  }, [customerId]);

  async function loadFinance() {
    setLoading(true);

    try {
      const customerResult = await supabase
        .from("customers")
        .select("id,name,province")
        .eq("id", customerId)
        .single();

      if (customerResult.error) throw customerResult.error;

      setCustomer(customerResult.data as Customer);

      const [ordersResult, paymentsResult, marketingResult] = await Promise.all([
        supabase
          .from("orders")
          .select("id,order_number,invoice_total,delivery_date")
          .eq("customer_id", customerId)
          .eq("status", "delivered")
          .order("delivery_date", { ascending: false }),

        supabase
          .from("payments")
          .select(
            "id,payment_number,attachment_urls,amount,payment_date,payment_type,description,bank_name,destination_account,tracking_code,terminal_number,pos_tracking_code,check_number,sayadi_number,check_issue_date,check_due_date,check_status"
          )
          .eq("customer_id", customerId)
          .order("payment_date", { ascending: false }),

        supabase
          .from("customer_marketing")
          .select(
            "id,start_date,end_date,shelf_rent,tray_rent,board_rent,promoter_cost,side_cost,foc_amount"
          )
          .eq("customer_id", customerId)
          .order("start_date", { ascending: false }),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (marketingResult.error) throw marketingResult.error;

      const orderRows: LedgerRow[] = (ordersResult.data || []).map(
        (order: any) => ({
          id: `order-${order.id}`,
          documentType: "سفارش",
          documentNumber: String(order.order_number || order.id),
          description: null,
          amount: Number(order.invoice_total || 0),
          // تاریخ دریافت بار، دقیقاً همان تاریخی است که «انبار» هنگام
          // تحویل سفارش ثبت می‌کند (delivery_date). اگر انبار هنوز
          // این تاریخ را ثبت نکرده باشد، به‌جای نمایش تاریخ نادرست
          // (مثل تاریخ ثبت سفارش)، خط تیره نمایش داده می‌شود.
          date: order.delivery_date || null,
        })
      );

      // ردیف‌های هزینه‌های مارکتینگ این مشتری؛
      // این هزینه‌ها مانند یک پرداختی برای مشتری محسوب می‌شوند
      // (بدهی مشتری را کاهش می‌دهند) و نوع سندشان «مارکتینگ» است.
      const marketingRows: LedgerRow[] = (marketingResult.data || []).map(
        (item: any) => {
          const totalAmount =
            Number(item.shelf_rent || 0) +
            Number(item.tray_rent || 0) +
            Number(item.board_rent || 0) +
            Number(item.promoter_cost || 0) +
            Number(item.side_cost || 0) +
            Number(item.foc_amount || 0);

          return {
            id: `marketing-${item.id}`,
            documentType: "مارکتینگ",
            documentNumber: "-",
            description: "هزینه‌های حمایتی مارکتینگ",
            amount: -totalAmount,
            date: item.end_date || item.start_date || null,
          };
        }
      );

      const paymentRows: LedgerRow[] = (paymentsResult.data || []).map(
        (payment: any) => ({
          id: `payment-${payment.id}`,
          documentType: "سند پرداختی",
          documentNumber: String(payment.payment_number || ""),
          description: payment.description || null,
          amount: -Number(payment.amount || 0),
          date: payment.payment_date || null,
          paymentType: payment.payment_type as PaymentType,
          payment: {
            id: payment.id,
            payment_number: payment.payment_number || null,
            attachment_urls: payment.attachment_urls || [],
            amount: Number(payment.amount || 0),
            payment_date: payment.payment_date || null,
            payment_type: payment.payment_type as PaymentType,
            description: payment.description || null,
            bank_name: payment.bank_name || null,
            destination_account: payment.destination_account || null,
            tracking_code: payment.tracking_code || null,
            terminal_number: payment.terminal_number || null,
            pos_tracking_code: payment.pos_tracking_code || null,
            check_number: payment.check_number || null,
            sayadi_number: payment.sayadi_number || null,
            check_issue_date: payment.check_issue_date || null,
            check_due_date: payment.check_due_date || null,
            check_status: payment.check_status || "not_due",
          },
        })
      );

      setLedger(
        [...orderRows, ...paymentRows, ...marketingRows].sort((a, b) => {
          const aTime = a.date ? new Date(a.date).getTime() : 0;
          const bTime = b.date ? new Date(b.date).getTime() : 0;
          return bTime - aTime;
        })
      );
    } catch (error: any) {
      console.error("FINANCE LOAD ERROR:", error);
      setCustomer(null);
      alert(
        `خطا در دریافت وضعیت مالی مشتری: ${
          error?.message || "خطای نامشخص"
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    const invoices = ledger
      .filter((row) => row.documentType === "سفارش")
      .reduce((sum, row) => sum + row.amount, 0);

    const payments = ledger
      .filter(
        (row) =>
          row.documentType === "سند پرداختی" ||
          row.documentType === "مارکتینگ"
      )
      .reduce((sum, row) => sum + Math.abs(row.amount), 0);

    return {
      invoices,
      payments,
      balance: invoices - payments,
    };
  }
, [ledger]);


  const filteredLedger = useMemo(() => {
    const normalizeDigits = (value: string) =>
      value
        .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

    const amountQuery = normalizeDigits(filters.amount).replace(
      /[^0-9]/g,
      ""
    );

    return ledger.filter((row) => {
      if (
        filters.documentType &&
        row.documentType !== filters.documentType
      ) {
        return false;
      }

      if (
        filters.paymentType &&
        (row.paymentType || "") !== filters.paymentType
      ) {
        return false;
      }

      if (filters.checkStatus) {
        if (row.paymentType !== "check") return false;

        if (
          normalizedCheckStatus(row.payment?.check_status) !==
          filters.checkStatus
        ) {
          return false;
        }
      }

      if (amountQuery) {
        const rowAmount = String(Math.abs(Number(row.amount || 0)));
        if (!rowAmount.includes(amountQuery)) return false;
      }

      if (filters.date && !faDate(row.date).includes(filters.date.trim())) {
        return false;
      }

      return true;
    });
  }, [ledger, filters]);

  function resetForm() {
    setEditingPaymentId(null);
    setPaymentFiles([]);
    setExistingAttachments([]);
    setPaymentType("cash");
    setAmount("");
    setDescription("");
    setBankName("");
    setDestinationAccount("");
    setTrackingCode("");
    setTerminalNumber("");
    setPosTrackingCode("");
    setCheckNumber("");
    setSayadiNumber("");
    setCheckIssueDate("");
    setCheckDueDate("");
    setCheckStatus("not_due");
  }

  function openEditPayment(row: LedgerRow) {
    if (row.documentType !== "سند پرداختی" || !row.payment) return;

    const payment = row.payment;

    setExistingAttachments(payment.attachment_urls || []);
    setPaymentFiles([]);
    setEditingPaymentId(payment.id);
    setPaymentType(payment.payment_type);
    setAmount(formatInputMoney(String(payment.amount)));
    setDescription(payment.description || "");
    setBankName(payment.bank_name || "");
    setDestinationAccount(payment.destination_account || "");
    setTrackingCode(payment.tracking_code || "");
    setTerminalNumber(payment.terminal_number || "");
    setPosTrackingCode(payment.pos_tracking_code || "");
    setCheckNumber(payment.check_number || "");
    setSayadiNumber(payment.sayadi_number || "");
    setCheckIssueDate(payment.check_issue_date || "");
    setCheckDueDate(payment.check_due_date || "");
    setCheckStatus(normalizedCheckStatus(payment.check_status));

    if (payment.payment_date) {
      setPaymentDate(payment.payment_date.substring(0, 10));
    }

    requestAnimationFrame(() => {
      document
        .getElementById("payment-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function updateCheckStatus(
    paymentId: string,
    status: "not_due" | "due" | "cleared"
  ) {
    const { data, error } = await supabase
      .from("payments")
      .update({ check_status: status })
      .eq("id", paymentId)
      .eq("customer_id", customerId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(error);
      alert(`خطا در تغییر وضعیت چک: ${error.message}`);
      return;
    }

    if (!data) {
      alert(
        "تغییر وضعیت انجام نشد. Policy مربوط به UPDATE جدول payments در Supabase را بررسی کنید."
      );
      return;
    }

    setLedger((previous) =>
      previous.map((row) =>
        row.payment?.id === paymentId && row.payment
          ? {
              ...row,
              payment: {
                ...row.payment,
                check_status: status,
              },
            }
          : row
      )
    );
  }



  function getStoragePathFromPublicUrl(url: string) {
    try {
      const parsed = new URL(url);
      const marker = "/storage/v1/object/public/payment-attachments/";
      const index = parsed.pathname.indexOf(marker);

      if (index === -1) return null;

      return decodeURIComponent(
        parsed.pathname.slice(index + marker.length)
      );
    } catch {
      return null;
    }
  }

  async function deleteAttachment(url: string) {
    if (
      !window.confirm(
        "این فایل از سند پرداختی حذف شود؟"
      )
    ) {
      return;
    }

    const path = getStoragePathFromPublicUrl(url);

    if (!path) {
      alert("مسیر فایل در Storage قابل تشخیص نیست.");
      return;
    }

    setSaving(true);

    try {
      const { error: storageError } = await supabase.storage
        .from("payment-attachments")
        .remove([path]);

      if (storageError) throw storageError;

      if (!editingPaymentId) {
        throw new Error("شناسه سند پرداختی مشخص نیست.");
      }

      const nextUrls = existingAttachments.filter(
        (item) => item !== url
      );

      const { error: dbError } = await supabase
        .from("payments")
        .update({ attachment_urls: nextUrls })
        .eq("id", editingPaymentId)
        .eq("customer_id", customerId);

      if (dbError) throw dbError;

      setExistingAttachments(nextUrls);

      setLedger((previous) =>
        previous.map((row) =>
          row.payment?.id === editingPaymentId && row.payment
            ? {
                ...row,
                payment: {
                  ...row.payment,
                  attachment_urls: nextUrls,
                },
              }
            : row
        )
      );
    } catch (error: any) {
      console.error("DELETE ATTACHMENT ERROR:", error);
      alert(
        `خطا در حذف فایل: ${
          error?.message || "خطای نامشخص"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment(row: LedgerRow) {
    if (
      row.documentType !== "سند پرداختی" ||
      !row.payment
    ) {
      return;
    }

    const confirmed = window.confirm(
      `سند پرداختی شماره ${row.payment.payment_number ?? "-"} حذف شود؟\n\nاین عملیات قابل برگشت نیست.`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const attachmentUrls =
        row.payment.attachment_urls || [];

      const storagePaths = attachmentUrls
        .map(getStoragePathFromPublicUrl)
        .filter(
          (path): path is string => Boolean(path)
        );

      if (storagePaths.length > 0) {
        const { error: storageError } =
          await supabase.storage
            .from("payment-attachments")
            .remove(storagePaths);

        if (storageError) throw storageError;
      }

      const { error: deleteError } = await supabase
        .from("payments")
        .delete()
        .eq("id", row.payment.id)
        .eq("customer_id", customerId);

      if (deleteError) throw deleteError;

      setLedger((previous) =>
        previous.filter(
          (item) => item.payment?.id !== row.payment!.id
        )
      );

      if (editingPaymentId === row.payment.id) {
        resetForm();
      }

      alert("سند پرداختی با موفقیت حذف شد.");
    } catch (error: any) {
      console.error("DELETE PAYMENT ERROR:", error);
      alert(
        `خطا در حذف سند پرداختی: ${
          error?.message || "خطای نامشخص"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadPaymentFiles(paymentId: string) {
    const urls: string[] = [];

    for (const file of paymentFiles) {
      if (
        !file.type.startsWith("image/") &&
        file.type !== "application/pdf"
      ) {
        continue;
      }

      const safeFileName = file.name
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-");

      const path = `payments/${customerId}/${paymentId}/${Date.now()}-${safeFileName}`;

      const { error } = await supabase.storage
        .from("payment-attachments")
        .upload(path, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from("payment-attachments")
        .getPublicUrl(path);

      urls.push(data.publicUrl);
    }

    return urls;
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = Number(normalizeNumber(amount));

    if (!numericAmount || numericAmount <= 0) {
      alert("مبلغ پرداخت را وارد کنید.");
      return;
    }

    if (paymentType === "bank_transfer" && !trackingCode.trim()) {
      alert("شناسه واریز را وارد کنید.");
      return;
    }

    if (paymentType === "pos" && !terminalNumber.trim()) {
      alert("شماره پایانه را وارد کنید.");
      return;
    }

    if (
      paymentType === "check" &&
      (!sayadiNumber.trim() || !checkDueDate)
    ) {
      alert("شماره صیادی و تاریخ وصول چک را وارد کنید.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        customer_id: customerId,
        payment_type: paymentType,
        amount: numericAmount,
        payment_date: paymentDate
          ? `${paymentDate}T00:00:00.000Z`
          : new Date().toISOString(),
        description: description.trim() || null,
        bank_name:
          paymentType === "bank_transfer" ? bankName.trim() || null : null,
        destination_account:
          paymentType === "bank_transfer"
            ? destinationAccount.trim() || null
            : null,
        tracking_code:
          paymentType === "bank_transfer"
            ? trackingCode.trim() || null
            : null,
        terminal_number:
          paymentType === "pos" ? terminalNumber.trim() || null : null,
        pos_tracking_code:
          paymentType === "pos" ? posTrackingCode.trim() || null : null,
        check_number:
          paymentType === "check" ? checkNumber.trim() || null : null,
        sayadi_number:
          paymentType === "check" ? sayadiNumber.trim() || null : null,
        check_issue_date:
          paymentType === "check" ? checkIssueDate || null : null,
        check_due_date:
          paymentType === "check" ? checkDueDate || null : null,
        check_status:
          paymentType === "check" ? checkStatus : null,
      };

      let paymentId = editingPaymentId;

      if (editingPaymentId) {
        const { data, error } = await supabase
          .from("payments")
          .update(payload)
          .eq("id", editingPaymentId)
          .eq("customer_id", customerId)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("ویرایش انجام نشد.");
      } else {
        const { data:lastPayment } = await supabase
          .from("payments")
          .select("payment_number")
          .eq("customer_id", customerId)
          .order("payment_number", { ascending:false })
          .limit(1)
          .maybeSingle();

        const nextNumber = Number(lastPayment?.payment_number || 0) + 1;

        const { data, error } = await supabase
          .from("payments")
          .insert({
            ...payload,
            payment_number: nextNumber,
            attachment_urls: []
          })
          .select("id")
          .single();

        if (error) throw error;
        paymentId = data.id;
      }

      if (paymentId && paymentFiles.length) {
        const urls = await uploadPaymentFiles(paymentId);

        const { error: attachmentUpdateError } =
          await supabase
            .from("payments")
            .update({
              attachment_urls: [
                ...existingAttachments,
                ...urls,
              ],
            })
            .eq("id", paymentId)
            .eq("customer_id", customerId);

        if (attachmentUpdateError) {
          throw attachmentUpdateError;
        }
      }

      resetForm();
      await loadFinance();

      alert(
        editingPaymentId
          ? "سند پرداختی با موفقیت ویرایش شد."
          : "سند پرداختی با موفقیت ثبت شد."
      );
    } catch (error: any) {
      console.error("PAYMENT SAVE ERROR:", error);
      alert(
        `${editingPaymentId ? "خطا در ویرایش" : "خطا در ثبت"} سند پرداختی: ${
          error?.message || "خطای نامشخص"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader
          title="وضعیت مالی مشتری"
          subtitle="در حال دریافت اطلاعات..."
        />
        <div
          className="panel"
          style={{ padding: 40, textAlign: "center" }}
        >
          در حال بارگذاری...
        </div>
      </AppShell>
    );
  }

  if (!customer) {
    return (
      <AppShell>
        <PageHeader title="وضعیت مالی مشتری" />
        <div
          className="panel"
          style={{ padding: 40, textAlign: "center" }}
        >
          مشتری پیدا نشد.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <style jsx>{`
        @media (max-width: 760px) {
          .finance-summary-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background:
            "linear-gradient(to bottom, rgba(248,250,252,0.98), rgba(248,250,252,0.94))",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          padding: "10px 0 14px",
          marginBottom: 18,
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
        }}
       >
        <div style={{ marginBottom: 14 }}>
          <PageHeader
            title={`وضعیت مالی ${customer.name}`}
            subtitle={customer.province || "استان ثبت نشده"}
            action={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/finance")}
            >
              <ArrowRight size={16} />
              برگشت
            </button>
            }
          />
        </div>

        <div
          className="finance-summary-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
        <div
          className="panel"
          style={{
            padding: "15px 18px",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            background: "#ffffff",
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            style={{
              color: "#64748b",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            مجموع فاکتورها
          </div>
          <strong
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "#0f172a",
              direction: "ltr",
              display: "block",
            }}
          >
            {money(totals.invoices)}
          </strong>
        </div>

        <div
          className="panel"
          style={{
            padding: "15px 18px",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            background: "#ffffff",
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            style={{
              color: "#64748b",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            مجموع پرداختی
          </div>
          <strong
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "#0f172a",
              direction: "ltr",
              display: "block",
            }}
          >
            {money(totals.payments)}
          </strong>
        </div>

        <div
          className="panel"
          style={{
            padding: "15px 18px",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            background: "#ffffff",
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            style={{
              color: "#64748b",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            مانده حساب
          </div>
          <strong
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: totals.balance > 0
                ? "#dc2626"
                : totals.balance < 0
                ? "#16a34a"
                : "#475569",
              direction: "ltr",
              display: "block",
              marginTop: 6,
            }}
          >
            {totals.balance > 0 ? "- " : totals.balance < 0 ? "+ " : ""}
            {money(Math.abs(totals.balance))}
          </strong>
        </div>
      </div>
      </div>

      <form
        id="payment-form"
        className="panel"
        onSubmit={savePayment}
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          {editingPaymentId
            ? "ویرایش سند پرداختی"
            : "ثبت پرداخت دستی"}
        </h3>

        <div className="form-grid">
          <div className="form-field">
            <label>نوع پرداخت</label>
            <select
              className="select"
              value={paymentType}
              onChange={(event) =>
                setPaymentType(
                  event.target.value as PaymentType
                )
              }
            >
              <option value="cash">نقدی</option>
              <option value="bank_transfer">
                واریز بانکی
              </option>
              <option value="pos">پوز</option>
              <option value="check">چک</option>
            </select>
          </div>

          <div className="form-field">
            <label>مبلغ</label>
            <input
              className="input"
              inputMode="numeric"
              value={amount}
              onChange={(event) =>
                setAmount(formatInputMoney(event.target.value))
              }
              placeholder="مبلغ پرداخت"
            />
          </div>

          <JalaliDateInput
            label="تاریخ دریافت"
            value={paymentDate}
            onChange={setPaymentDate}
            minYear={currentJalali.jy - 10}
            maxYear={currentJalali.jy + 5}
          />

          {paymentType === "bank_transfer" && (
            <>
              <div className="form-field">
                <label>نام بانک</label>
                <input
                  className="input"
                  value={bankName}
                  onChange={(event) =>
                    setBankName(event.target.value)
                  }
                />
              </div>

              <div className="form-field">
                <label>حساب مقصد</label>
                <input
                  className="input"
                  value={destinationAccount}
                  onChange={(event) =>
                    setDestinationAccount(
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="form-field">
                <label>شناسه واریز</label>
                <input
                  className="input"
                  value={trackingCode}
                  onChange={(event) =>
                    setTrackingCode(event.target.value)
                  }
                />
              </div>
            </>
          )}

          {paymentType === "pos" && (
            <>
              <div className="form-field">
                <label>شماره پایانه</label>
                <input
                  className="input"
                  value={terminalNumber}
                  onChange={(event) =>
                    setTerminalNumber(event.target.value)
                  }
                />
              </div>

              <div className="form-field">
                <label>شماره پیگیری تراکنش</label>
                <input
                  className="input"
                  value={posTrackingCode}
                  onChange={(event) =>
                    setPosTrackingCode(event.target.value)
                  }
                />
              </div>
            </>
          )}

          {paymentType === "check" && (
            <>
              <div className="form-field">
                <label>شماره چک</label>
                <input
                  className="input"
                  value={checkNumber}
                  onChange={(event) =>
                    setCheckNumber(event.target.value)
                  }
                />
              </div>

              <div className="form-field">
                <label>شناسه صیادی</label>
                <input
                  className="input"
                  value={sayadiNumber}
                  onChange={(event) =>
                    setSayadiNumber(event.target.value)
                  }
                />
              </div>

              <JalaliDateInput
                label="تاریخ صدور"
                value={checkIssueDate}
                onChange={setCheckIssueDate}
                minYear={currentJalali.jy - 10}
                maxYear={currentJalali.jy + 5}
              />

              <JalaliDateInput
                label="تاریخ وصول"
                value={checkDueDate}
                onChange={setCheckDueDate}
                minYear={currentJalali.jy - 10}
                maxYear={currentJalali.jy + 5}
              />

              <div className="form-field">
                <label>وضعیت چک</label>
                <select
                  className="select"
                  value={checkStatus}
                  onChange={(event) =>
                    setCheckStatus(event.target.value)
                  }
                >
                  <option value="received">
                    دریافت شده
                  </option>
                  <option value="cleared">
                    وصول شده
                  </option>
                  <option value="returned">
                    برگشتی
                  </option>
                </select>
              </div>
            </>
          )}

          <div className="form-field full">
            <label>ضمیمه سند پرداختی (تصویر / PDF)</label>
            <input
              className="input"
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(event) =>
                setPaymentFiles(
                  event.target.files
                    ? Array.from(event.target.files)
                    : []
                )
              }
            />

            {existingAttachments.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {existingAttachments.map((url, index) => (
                  <div
                    key={url}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "8px 10px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      background: "#f8fafc",
                    }}
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: "#334155",
                        textDecoration: "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      }}
                    >
                      <Paperclip size={14} style={{ verticalAlign: "middle", marginLeft: 6 }} />
                      سند {toPersianDigits(index + 1)}
                    </a>

                    {editingPaymentId && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => deleteAttachment(url)}
                        disabled={saving}
                        title="حذف فایل"
                        style={{
                          color: "#b91c1c",
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={14} />
                        حذف
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-field full">
            <label>توضیحات</label>
            <textarea
              className="textarea"
              rows={2}
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="توضیحات مربوط به پرداخت"
            />
          </div>
        </div>

        <div
          className="action-row"
          style={{ marginTop: 16 }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              <Save size={16} />
              {saving
                ? "در حال ذخیره..."
                : editingPaymentId
                ? "ذخیره تغییرات"
                : "ثبت سند پرداختی"}
            </button>

            {editingPaymentId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
                disabled={saving}
              >
                انصراف
              </button>
            )}
          </div>
        </div>
      </form>

      <div
        className="panel"
        style={{
          marginTop: 16,
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <h3 style={{ margin: 0 }}>
            گردش حساب مشتری
          </h3>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            نمایش {toPersianDigits(filteredLedger.length)} سند از{" "}
            {toPersianDigits(ledger.length)}
          </div>
        </div>

        <div
          style={{
            width: "100%",
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
            }}
          >
            <thead>
              <tr style={{ background: "#fbfdff" }}>
                <th
                  style={{
                    color: "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "12px 10px",
                  }}
                >
                  شماره سند
                </th>
                <th
                  style={{
                    color: "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "12px 10px",
                  }}
                >
                  نوع سند
                </th>
                <th
                  style={{
                    color: "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "12px 10px",
                  }}
                >
                  مبلغ
                </th>
                <th
                  style={{
                    color: "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "12px 10px",
                  }}
                >
                  تاریخ دریافت
                </th>
                <th
                  style={{
                    color: "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "12px 10px",
                  }}
                >
                  وضعیت
                </th>
                <th
                  style={{
                    color: "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "12px 10px",
                  }}
                >
                  عملیات
                </th>
                <th
                  style={{
                    color: "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "12px 10px",
                  }}
                >
                  توضیحات
                </th>
              </tr>

              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: 6 }}>
                  <select
                    className="select"
                    value={filters.documentType}
                    onChange={(event) =>
                      setFilter("documentType", event.target.value)
                    }
                    style={{ width: "100%", fontSize: 12 }}
                  >
                    <option value="">همه</option>
                    <option value="سفارش">سفارش</option>
                    <option value="سند پرداختی">سند پرداختی</option>
                    <option value="مارکتینگ">مارکتینگ</option>
                  </select>
                </th>

                <th style={{ padding: 6 }}>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={filters.amount}
                    onChange={(event) =>
                      setFilter("amount", event.target.value)
                    }
                    placeholder="مبلغ"
                    style={{ width: "100%", fontSize: 12 }}
                  />
                </th>

                <th style={{ padding: 6 }}>
                  <input
                    className="input"
                    value={filters.date}
                    onChange={(event) =>
                      setFilter("date", event.target.value)
                    }
                    placeholder="۱۴۰۵/۰۵"
                    style={{ width: "100%", fontSize: 12 }}
                  />
                </th>

                <th style={{ padding: 6 }}>
                  <select
                    className="select"
                    value={filters.checkStatus}
                    onChange={(event) =>
                      setFilter("checkStatus", event.target.value)
                    }
                    style={{ width: "100%", fontSize: 12 }}
                  >
                    <option value="">همه</option>
                    <option value="not_due">عدم سررسید</option>
                    <option value="due">سررسید</option>
                    <option value="cleared">وصول</option>
                  </select>
                </th>

                <th style={{ padding: 6 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select
                      className="select"
                      value={filters.paymentType}
                      onChange={(event) =>
                        setFilter("paymentType", event.target.value)
                      }
                      style={{ width: "100%", fontSize: 12 }}
                    >
                      <option value="">همه</option>
                      <option value="cash">نقدی</option>
                      <option value="bank_transfer">واریز</option>
                      <option value="pos">پوز</option>
                      <option value="check">چک</option>
                    </select>

                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={clearFilters}
                      title="پاک کردن فیلترها"
                    >
                      ×
                    </button>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: 30,
                    }}
                  >
                    هنوز سندی برای این مشتری ثبت نشده است.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row) => (
                  <tr
                    key={row.id}
                    style={{}}
                  >
                    <td>{toPersianDigits(row.documentNumber || "-")}</td>

                    <td>
                      {row.documentType}
                      {row.paymentType
                        ? ` - ${paymentLabels[row.paymentType]}`
                        : ""}
                    </td>

                    <td
                      style={{
                        fontWeight: 800,
                        color:
                          row.documentType === "سفارش"
                            ? "#b91c1c"
                            : "#15803d",
                        direction: "ltr",
                        textAlign: "right",
                      }}
                    >
                      {row.documentType === "سفارش" ? "- " : "+ "}
                      {money(row.amount)}
                    </td>

                    <td>{faDate(row.date)}</td>

                    <td>
                      {row.paymentType === "check" && row.payment ? (
                        <select
                          className="select"
                          value={normalizedCheckStatus(
                            row.payment.check_status
                          )}
                          onChange={(event) =>
                            updateCheckStatus(
                              row.payment!.id,
                              event.target.value as
                                | "not_due"
                                | "due"
                                | "cleared"
                            )
                          }
                          style={{
                            minWidth: 118,
                            background: getCheckStatusMeta(
                              row.payment.check_status
                            ).background,
                            color: getCheckStatusMeta(
                              row.payment.check_status
                            ).color,
                            fontWeight: 700,
                          }}
                        >
                          <option value="not_due">عدم سررسید</option>
                          <option value="due">سررسید</option>
                          <option value="cleared">وصول</option>
                        </select>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>

                    <td>
                      {row.documentType === "سند پرداختی" ? (
                        <>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={() => openEditPayment(row)}
                              disabled={saving}
                            >
                              ویرایش
                            </button>

                            {row.payment?.attachment_urls?.length ? (
                              <a
                                className="btn btn-secondary btn-small"
                                href={row.payment.attachment_urls[0]}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Paperclip size={14} />
                                {toPersianDigits(
                                  row.payment.attachment_urls.length
                                )}{" "}
                                فایل
                              </a>
                            ) : null}

                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={() => deletePayment(row)}
                              disabled={saving}
                              title="حذف سند پرداختی"
                              style={{
                                color: "#b91c1c",
                              }}
                            >
                              <Trash2 size={14} />
                              حذف
                            </button>
                          </div>
                        </>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>

                    <td>{row.description || "—"}</td>
                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
