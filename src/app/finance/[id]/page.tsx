"use client";

import { FormEvent, type MouseEvent as ReactMouseEvent, type ReactElement, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Save,
  Trash2,
  Paperclip,
  Link2,
  ChevronDown,
  Filter,
  Zap,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";

type PaymentType = "cash" | "bank_transfer" | "pos" | "check";

type Customer = {
  id: string;
  name: string;
  province?: string | null;
  settlement_days?: number | null;
  customer_group_id?: string | null;
};

type PaymentAllocation = {
  id: string;
  payment_id: string | null;
  marketing_id: string | null;
  order_id: string;
  amount: number;
};

type MarketingRaw = {
  id: string;
  totalAmount: number;
};

type OrderRaw = {
  id: string;
  order_number: string | number;
  customer_id?: string | null;
  branch_name?: string | null;
  invoice_total: number;
  delivery_date: string | null;
  settlement_due_date: string | null;
};

type PaymentRecord = {
  id: string;
  customer_id?: string | null;
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
  deliveryDate?: string | null;
  settlementDueDate?: string | null;
  paymentType?: PaymentType;
  payment?: PaymentRecord;
  orderId?: string;
  invoiceTotal?: number;
  marketingId?: string;
  sourceCustomerId?: string | null;
};

type FilterSelection = string[] | null;
type LedgerFilterKey =
  | "documentNumber"
  | "documentType"
  | "amount"
  | "date"
  | "settlementDueDate"
  | "checkStatus"
  | "description";
type SettlementFilterKey =
  | "orderNumber"
  | "branch"
  | "deliveryDate"
  | "settlementDueDate"
  | "invoiceTotal"
  | "paid"
  | "remaining"
  | "daysToSettlement"
  | "progress"
  | "status";

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

const SETTLEMENT_META: Record<
  "settled" | "partial" | "unpaid",
  { label: string; background: string; color: string }
> = {
  settled: { label: "تسویه کامل", background: "#dcfce7", color: "#166534" },
  partial: { label: "پرداخت ناقص", background: "#fef3c7", color: "#92400e" },
  unpaid: { label: "بدون پرداخت", background: "#fee2e2", color: "#b91c1c" },
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

function parseFinanceDate(value: string | null) {
  if (!value) return null;

  const clean = String(value).trim();
  const datePart = clean.split(" ")[0];
  const slashParts = datePart.split("/");

  // تاریخ شمسی ذخیره‌شده مثل ۱۴۰۵/۰۵/۳۱
  if (
    slashParts.length === 3 &&
    Number(slashParts[0]) >= 1300 &&
    Number(slashParts[0]) <= 1500
  ) {
    const jy = Number(slashParts[0]);
    const jm = Number(slashParts[1]);
    const jd = Number(slashParts[2]);

    if (
      Number.isInteger(jy) &&
      Number.isInteger(jm) &&
      Number.isInteger(jd) &&
      jm >= 1 &&
      jm <= 12 &&
      jd >= 1 &&
      jd <= jalaliDaysInMonth(jy, jm)
    ) {
      const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
      return new Date(Date.UTC(gy, gm - 1, gd, 12, 0, 0));
    }
  }

  // تاریخ میلادی/ISO مثل 2026-08-13
  const isoDate = datePart.substring(0, 10);
  const [gy, gm, gd] = isoDate.split("-").map(Number);

  if (
    Number.isInteger(gy) &&
    Number.isInteger(gm) &&
    Number.isInteger(gd) &&
    gm >= 1 &&
    gm <= 12 &&
    gd >= 1 &&
    gd <= 31
  ) {
    return new Date(Date.UTC(gy, gm - 1, gd, 12, 0, 0));
  }

  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime())
    ? null
    : new Date(
        Date.UTC(
          parsed.getFullYear(),
          parsed.getMonth(),
          parsed.getDate(),
          12,
          0,
          0
        )
      );
}

function faDate(value: string | null) {
  const date = parseFinanceDate(value);
  if (!date) return "-";

  const { jy, jm, jd } = gregorianToJalali(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );

  return `${toPersianDigits(jy)}/${toPersianDigits(
    String(jm).padStart(2, "0")
  )}/${toPersianDigits(String(jd).padStart(2, "0"))}`;
}

function calculateSettlementDueDate(
  deliveryDate: string | null,
  settlementDays: number | null | undefined
) {
  const delivery = parseFinanceDate(deliveryDate);
  const days = Number(settlementDays || 0);

  if (!delivery || !Number.isFinite(days)) {
    return null;
  }

  const due = new Date(delivery.getTime());
  due.setUTCDate(due.getUTCDate() + Math.trunc(days));

  return `${due.getUTCFullYear()}-${String(
    due.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(due.getUTCDate()).padStart(2, "0")}`;
}

function formatWarehouseDeliveryDate(value: string | null) {
  return faDate(value);
}

function formatSettlementDueDate(value: string | null) {
  return faDate(value);
}

function daysUntilSettlement(value: string | null) {
  const dueDate = parseFinanceDate(value);
  if (!dueDate) return null;

  const today = new Date();
  const todayStart = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0)
  );

  return Math.round(
    (dueDate.getTime() - todayStart.getTime()) / 86400000
  );
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

  const customerId = String(params?.id ?? "");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [branchCount, setBranchCount] = useState(0);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [orders, setOrders] = useState<OrderRaw[]>([]);
  const [marketingItems, setMarketingItems] = useState<MarketingRaw[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentJalali = useMemo(() => getCurrentJalali(), []);

  // ---- payment form state ----
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

  const [ledgerFilters, setLedgerFilters] = useState<Record<LedgerFilterKey, FilterSelection>>({
    documentNumber: null,
    documentType: null,
    amount: null,
    date: null,
    settlementDueDate: null,
    checkStatus: null,
    description: null,
  });

  const [settlementFilters, setSettlementFilters] = useState<Record<SettlementFilterKey, FilterSelection>>({
    orderNumber: null,
    branch: null,
    deliveryDate: null,
    settlementDueDate: null,
    invoiceTotal: null,
    paid: null,
    remaining: null,
    daysToSettlement: null,
    progress: null,
    status: null,
  });

  const [openLedgerFilter, setOpenLedgerFilter] = useState<LedgerFilterKey | null>(null);
  const [openSettlementFilter, setOpenSettlementFilter] = useState<SettlementFilterKey | null>(null);

  // ---- column widths (Excel-like manual resizing) ----
  const [settlementColumnWidths, setSettlementColumnWidths] = useState<number[]>([
    120, 145, 130, 140, 150, 150, 145, 135, 150, 130,
  ]);

  const [ledgerColumnWidths, setLedgerColumnWidths] = useState<number[]>([
    120, 120, 145, 155, 155, 130, 175, 240,
  ]);

  // ---- allocation state ----
  const [expandedSource, setExpandedSource] = useState<{
    type: "payment" | "marketing";
    id: string;
  } | null>(null);
  const [allocationDrafts, setAllocationDrafts] = useState<
    Record<string, string>
  >({});
  const [savingAllocations, setSavingAllocations] = useState(false);

  function setLedgerColumnFilter(key: LedgerFilterKey, value: FilterSelection) {
    setLedgerFilters((previous) => ({ ...previous, [key]: value }));
  }

  function setSettlementColumnFilter(
    key: SettlementFilterKey,
    value: FilterSelection
  ) {
    setSettlementFilters((previous) => ({ ...previous, [key]: value }));
  }

  function resizeSettlementColumn(index: number, delta: number) {
    setSettlementColumnWidths((previous) => {
      const next = [...previous];
      next[index] = Math.max(75, next[index] + delta);
      return next;
    });
  }

  function resizeLedgerColumn(index: number, delta: number) {
    setLedgerColumnWidths((previous) => {
      const next = [...previous];
      next[index] = Math.max(75, next[index] + delta);
      return next;
    });
  }

  function clearLedgerFilters() {
    setLedgerFilters({
      documentNumber: null,
      documentType: null,
      amount: null,
      date: null,
      settlementDueDate: null,
      checkStatus: null,
      description: null,
    });
    setOpenLedgerFilter(null);
  }

  function clearSettlementFilters() {
    setSettlementFilters({
      orderNumber: null,
      branch: null,
      deliveryDate: null,
      settlementDueDate: null,
      invoiceTotal: null,
      paid: null,
      remaining: null,
      daysToSettlement: null,
      progress: null,
      status: null,
    });
    setOpenSettlementFilter(null);
  }

  useEffect(() => {
    if (customerId) {
      loadFinance();
    }
  }, [customerId]);

  // اگر پرداخت بازشده دیگر در لیست فیلترشده نبود، پنل عطف را ببند
  // (این useEffect بعد از تعریف filteredLedger قرار گرفته است)

  async function loadFinance() {
    setLoading(true);

    try {
      // ----------------------------------------------------------
      // 1) مشتری فعلی + ساختار مجموعه
      // ----------------------------------------------------------
      const { data: baseCustomer, error: baseCustomerError } =
        await supabase
          .from("customers")
          .select("id,name,province,settlement_days,customer_group_id")
          .eq("id", customerId)
          .single();

      if (baseCustomerError) {
        throw baseCustomerError;
      }

      let parentCustomerId = customerId;
      let currentGroupId: string | null =
        baseCustomer?.customer_group_id || null;
      let currentGroupName: string | null = null;

      if (currentGroupId) {
        const { data: groupRow, error: groupError } =
          await supabase
            .from("customer_groups")
            .select("id,name,primary_customer_id")
            .eq("id", currentGroupId)
            .single();

        if (groupError) {
          throw groupError;
        }

        currentGroupName = groupRow?.name || null;
        parentCustomerId =
          groupRow?.primary_customer_id || customerId;
      } else {
        // اگر خود مشتری مادر باشد، گروه را از primary_customer_id پیدا کن.
        const { data: ownedGroup, error: ownedGroupError } =
          await supabase
            .from("customer_groups")
            .select("id,name,primary_customer_id")
            .eq("primary_customer_id", customerId)
            .maybeSingle();

        if (ownedGroupError) {
          throw ownedGroupError;
        }

        if (ownedGroup) {
          currentGroupId = ownedGroup.id;
          currentGroupName = ownedGroup.name;
          parentCustomerId = ownedGroup.primary_customer_id;
        }
      }

      // ----------------------------------------------------------
      // 2) همه شعب این مجموعه
      // ----------------------------------------------------------
      let scopedCustomerIds = [parentCustomerId];
      let groupCustomers: any[] = [];

      if (currentGroupId) {
        const {
          data: loadedGroupCustomers,
          error: groupCustomersError,
        } = await supabase
          .from("customers")
          .select("id,name,customer_group_id")
          .eq("customer_group_id", currentGroupId);

        if (groupCustomersError) {
          throw groupCustomersError;
        }

        groupCustomers = loadedGroupCustomers || [];

        scopedCustomerIds = groupCustomers
          .filter(
            (row: any) => row.id !== parentCustomerId
          )
          .map((row: any) => row.id);

        const count = scopedCustomerIds.length;

        setBranchCount(count);

        // اگر مشتری فعلی یک شعبه بود، عنوان صفحه همچنان نام مادر است.
        if (currentGroupName) {
          setGroupName(currentGroupName);
        }
      } else {
        setBranchCount(0);
        setGroupName(baseCustomer?.name || null);
      }

      // ----------------------------------------------------------
      // 3) دریافت همه سفارش‌های تمام شعب
      // ----------------------------------------------------------
      const { data: ordersData, error: ordersError } =
        await supabase
          .from("orders")
          .select(
            "id,order_number,customer_id,invoice_total,delivery_date,settlement_due_date"
          )
          .in("customer_id", scopedCustomerIds)
          .eq("status", "delivered")
          .order("delivery_date", { ascending: false });

      if (ordersError) {
        throw ordersError;
      }

      // ----------------------------------------------------------
      // 4) همه پرداختی‌ها
      //
      // در مجموعه‌ها «پرداخت» می‌تواند روی مشتری مادر ثبت شود،
      // در حالی که سفارش‌ها فقط روی شعبه‌ها ثبت می‌شوند.
      // بنابراین برای پرداختی‌ها، علاوه بر شعب، مشتری مادر را هم
      // در محدوده جستجو نگه می‌داریم تا سند پرداخت بعد از ثبت
      // در صفحه همان مجموعه بلافاصله نمایش داده شود.
      // ----------------------------------------------------------
      const paymentScopedCustomerIds = currentGroupId
        ? Array.from(new Set([...scopedCustomerIds, parentCustomerId]))
        : scopedCustomerIds;

      const { data: paymentsData, error: paymentsError } =
        await supabase
          .from("payments")
          .select(`
            id,
            customer_id,
            payment_number,
            amount,
            payment_date,
            payment_type,
            description,
            bank_name,
            destination_account,
            tracking_code,
            terminal_number,
            pos_tracking_code,
            check_number,
            sayadi_number,
            check_issue_date,
            check_due_date,
            check_status,
            attachment_urls
          `)
          .in("customer_id", paymentScopedCustomerIds)
          .order("payment_date", { ascending: false });

      if (paymentsError) {
        throw paymentsError;
      }

      // ----------------------------------------------------------
      // 5) همه مارکتینگ‌های تمام شعب
      // ----------------------------------------------------------
      const { data: marketingData, error: marketingError } =
        await supabase
          .from("customer_marketing")
          .select(`
            id,
            customer_id,
            shelf_rent,
            tray_rent,
            board_rent,
            promoter_cost,
            side_cost,
            foc_amount,
            start_date,
            end_date
          `)
          .in("customer_id", scopedCustomerIds)
          .order("end_date", { ascending: false });

      if (marketingError) {
        throw marketingError;
      }

      // ----------------------------------------------------------
      // 6) تخصیص پرداخت‌ها / مارکتینگ‌ها به سفارش‌ها
      // ----------------------------------------------------------
      const { data: allocationData, error: allocationError } =
        await supabase
          .from("payment_allocations")
          .select("id,payment_id,marketing_id,order_id,amount")
          .in("customer_id", paymentScopedCustomerIds);

      if (allocationError) {
        throw allocationError;
      }

      setAllocations(allocationData || []);

      setCustomer({
        ...baseCustomer,
        id: parentCustomerId,
        name:
          currentGroupName ||
          (parentCustomerId === customerId
            ? baseCustomer?.name
            : baseCustomer?.name),
      });

      const customerNameMap = new Map(
        (groupCustomers || []).map((customer: any) => [
          customer.id,
          customer.name,
        ])
      );

      const settlementDays = Number(baseCustomer?.settlement_days || 0);

      const ordersWithBranchName = (ordersData || []).map(
        (order: any) => ({
          ...order,
          branch_name:
            customerNameMap.get(order.customer_id) || "-",
          // موعد تسویه واقعی:
          // تاریخ تحویل سفارش + مدت تسویه مشتری
          // مقدار settlement_due_date قبلی دیتابیس برای نمایش ملاک نیست.
          settlement_due_date: calculateSettlementDueDate(
            order.delivery_date || null,
            settlementDays
          ),
        })
      );

      setOrders(ordersWithBranchName);
      setMarketingItems(
        (marketingData || []).map((item: any) => ({
          id: item.id,
          totalAmount:
            Number(item.shelf_rent || 0) +
            Number(item.tray_rent || 0) +
            Number(item.board_rent || 0) +
            Number(item.promoter_cost || 0) +
            Number(item.side_cost || 0) +
            Number(item.foc_amount || 0),
        }))
      );

      const orderRows: LedgerRow[] = (ordersWithBranchName || []).map(
        (order: any) => ({
          id: `order-${order.id}`,
          orderId: order.id,
          documentType: "سفارش",
          documentNumber: String(
            order.order_number || order.id
          ),
          description: null,
          amount: Number(order.invoice_total || 0),
          invoiceTotal: Number(order.invoice_total || 0),
          date: order.delivery_date || null,
          // منبع «تاریخ تحویل» دقیقاً همان orders.delivery_date است
          // که صفحه اول انبار در ستون «تاریخ تحویل سفارش» نمایش می‌دهد.
          deliveryDate: order.delivery_date || null,
          settlementDueDate:
            order.settlement_due_date || null,
          sourceCustomerId: order.customer_id || null,
        })
      );

      const marketingRows: LedgerRow[] = (marketingData || []).map(
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
            marketingId: item.id,
            documentType: "مارکتینگ",
            documentNumber: "-",
            description: "هزینه‌های حمایتی مارکتینگ",
            amount: -totalAmount,
            date: item.end_date || item.start_date || null,
            sourceCustomerId: item.customer_id || null,
          };
        }
      );

      const paymentRows: LedgerRow[] = (paymentsData || []).map(
        (payment: any) => ({
          id: `payment-${payment.id}`,
          documentType: "سند پرداختی",
          documentNumber: String(
            payment.payment_number || ""
          ),
          description: payment.description || null,
          amount: -Number(payment.amount || 0),
          date: payment.payment_date || null,
          paymentType: payment.payment_type as PaymentType,
          sourceCustomerId: payment.customer_id || null,
          payment: {
            id: payment.id,
            customer_id: payment.customer_id || null,
            payment_number: payment.payment_number || null,
            attachment_urls: payment.attachment_urls || [],
            amount: Number(payment.amount || 0),
            payment_date: payment.payment_date || null,
            payment_type: payment.payment_type as PaymentType,
            description: payment.description || null,
            bank_name: payment.bank_name || null,
            destination_account:
              payment.destination_account || null,
            tracking_code:
              payment.tracking_code || null,
            terminal_number:
              payment.terminal_number || null,
            pos_tracking_code:
              payment.pos_tracking_code || null,
            check_number:
              payment.check_number || null,
            sayadi_number:
              payment.sayadi_number || null,
            check_issue_date:
              payment.check_issue_date || null,
            check_due_date:
              payment.check_due_date || null,
            check_status:
              payment.check_status || "not_due",
          },
        })
      );

      setLedger(
        [...orderRows, ...paymentRows, ...marketingRows].sort((a, b) => {
          const rank = (row: LedgerRow) =>
            row.documentType === "سند پرداختی"
              ? 0
              : row.documentType === "سفارش"
              ? 1
              : 2;

          const rankDiff = rank(a) - rank(b);
          if (rankDiff !== 0) return rankDiff;

          const aTime = a.date ? new Date(a.date).getTime() : 0;
          const bTime = b.date ? new Date(b.date).getTime() : 0;
          return bTime - aTime;
        })
      );
    } catch (error: any) {
      console.error("FINANCE GROUP LOAD ERROR:", error);
      setCustomer(null);
      alert(
        `خطا در دریافت وضعیت مالی مجموعه: ${
          error?.message || "خطای نامشخص"
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  // ---- maps from allocations ----
  const orderAllocationMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of allocations) {
      map[a.order_id] = (map[a.order_id] || 0) + a.amount;
    }
    return map;
  }, [allocations]);

  const paymentAllocationMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of allocations) {
      if (a.payment_id) {
        map[a.payment_id] = (map[a.payment_id] || 0) + a.amount;
      }
    }
    return map;
  }, [allocations]);

  const marketingAllocationMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of allocations) {
      if (a.marketing_id) {
        map[a.marketing_id] = (map[a.marketing_id] || 0) + a.amount;
      }
    }
    return map;
  }, [allocations]);

  // ---- settlement per order ----
  const orderSettlements = useMemo(() => {
    return orders.map((order) => {
      const paid = orderAllocationMap[order.id] || 0;
      const remaining = order.invoice_total - paid;
      const status: "settled" | "partial" | "unpaid" =
        remaining <= 0 ? "settled" : paid > 0 ? "partial" : "unpaid";
      return {
        ...order,
        paid,
        remaining: Math.max(0, remaining),
        daysToSettlement: daysUntilSettlement(order.settlement_due_date),
        status,
        progress:
          order.invoice_total > 0
            ? Math.min(100, (paid / order.invoice_total) * 100)
            : 0,
      };
    });
  }, [orders, orderAllocationMap]);

  const settlementFilterValues = useMemo(() => {
    const unique = (values: string[]) =>
      Array.from(new Set(values)).sort((a, b) =>
        a.localeCompare(b, "fa", { numeric: true })
      );

    return {
      orderNumber: unique(orderSettlements.map((row) => toPersianDigits(String(row.order_number ?? "-")))),
      branch: unique(orderSettlements.map((row) => row.branch_name || "-")),
      deliveryDate: unique(orderSettlements.map((row) => formatWarehouseDeliveryDate(row.delivery_date))),
      settlementDueDate: unique(
        orderSettlements.map((row) => formatSettlementDueDate(row.settlement_due_date))
      ),
      invoiceTotal: unique(orderSettlements.map((row) => money(row.invoice_total))),
      paid: unique(orderSettlements.map((row) => money(row.paid))),
      remaining: unique(orderSettlements.map((row) => money(row.remaining))),
      daysToSettlement: unique(
        orderSettlements.map((row) =>
          row.daysToSettlement === null
            ? "-"
            : toPersianDigits(row.daysToSettlement)
        )
      ),
      progress: unique(
        orderSettlements.map((row) =>
          `${toPersianDigits(Math.round(row.progress))}٪`
        )
      ),
      status: unique(
        orderSettlements.map((row) => SETTLEMENT_META[row.status]?.label || row.status)
      ),
    };
  }, [orderSettlements]);

  function matchesSelected(value: string, selection: FilterSelection) {
    return selection === null || selection.includes(value);
  }

  const filteredOrderSettlements = useMemo(() => {
    return orderSettlements.filter((row) =>
      matchesSelected(
        toPersianDigits(String(row.order_number ?? "-")),
        settlementFilters.orderNumber
      ) &&
      matchesSelected(row.branch_name || "-", settlementFilters.branch) &&
      matchesSelected(formatWarehouseDeliveryDate(row.delivery_date), settlementFilters.deliveryDate) &&
      matchesSelected(
        formatSettlementDueDate(row.settlement_due_date),
        settlementFilters.settlementDueDate
      ) &&
      matchesSelected(money(row.invoice_total), settlementFilters.invoiceTotal) &&
      matchesSelected(money(row.paid), settlementFilters.paid) &&
      matchesSelected(money(row.remaining), settlementFilters.remaining) &&
      matchesSelected(
        row.daysToSettlement === null
          ? "-"
          : toPersianDigits(row.daysToSettlement),
        settlementFilters.daysToSettlement
      ) &&
      matchesSelected(
        `${toPersianDigits(Math.round(row.progress))}٪`,
        settlementFilters.progress
      ) &&
      matchesSelected(
        SETTLEMENT_META[row.status]?.label || row.status,
        settlementFilters.status
      )
    );
  }, [orderSettlements, settlementFilters]);

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

    const totalAllocated = allocations.reduce(
      (sum, a) => sum + a.amount,
      0
    );

    const totalPayments = ledger
      .filter((row) => row.documentType === "سند پرداختی")
      .reduce((sum, row) => sum + Math.abs(row.amount), 0);

    const unallocated = totalPayments - totalAllocated;

    const invoiceRemaining = orderSettlements.reduce(
      (sum, o) => sum + o.remaining,
      0
    );

    return {
      invoices,
      payments,
      balance: invoices - payments,
      totalAllocated,
      unallocated,
      invoiceRemaining,
    };
  }, [ledger, allocations, orderSettlements]);

  const ledgerFilterValues = useMemo(() => {
    const unique = (values: string[]) =>
      Array.from(new Set(values)).sort((a, b) =>
        a.localeCompare(b, "fa", { numeric: true })
      );

    return {
      documentNumber: unique(ledger.map((row) => toPersianDigits(row.documentNumber || "-"))),
      documentType: unique(
        ledger.map((row) =>
          row.paymentType
            ? `${row.documentType} - ${paymentLabels[row.paymentType]}`
            : row.documentType
        )
      ),
      amount: unique(
        ledger.map((row) =>
          `${row.documentType === "سفارش" ? "- " : "+ "}${money(row.amount)}`
        )
      ),
      date: unique(
        ledger.map((row) =>
          row.documentType === "سفارش" ? faDate(row.deliveryDate || null) : "—"
        )
      ),
      settlementDueDate: unique(
        ledger.map((row) =>
          row.documentType === "سفارش" ? faDate(row.settlementDueDate || null) : "—"
        )
      ),
      checkStatus: unique(
        ledger.map((row) =>
          row.paymentType === "check" && row.payment
            ? getCheckStatusMeta(row.payment.check_status).label
            : "—"
        )
      ),
      description: unique(ledger.map((row) => row.description || "—")),
    };
  }, [ledger]);

  const filteredLedger = useMemo(() => {
    return ledger.filter((row) => {
      const documentTypeValue = row.paymentType
        ? `${row.documentType} - ${paymentLabels[row.paymentType]}`
        : row.documentType;
      const amountValue =
        `${row.documentType === "سفارش" ? "- " : "+ "}${money(row.amount)}`;
      const dateValue =
        row.documentType === "سفارش" ? faDate(row.deliveryDate || null) : "—";
      const dueValue =
        row.documentType === "سفارش"
          ? faDate(row.settlementDueDate || null)
          : "—";
      const checkStatusValue =
        row.paymentType === "check" && row.payment
          ? getCheckStatusMeta(row.payment.check_status).label
          : "—";
      const descriptionValue = row.description || "—";

      return (
        matchesSelected(
          toPersianDigits(row.documentNumber || "-"),
          ledgerFilters.documentNumber
        ) &&
        matchesSelected(documentTypeValue, ledgerFilters.documentType) &&
        matchesSelected(amountValue, ledgerFilters.amount) &&
        matchesSelected(dateValue, ledgerFilters.date) &&
        matchesSelected(dueValue, ledgerFilters.settlementDueDate) &&
        matchesSelected(checkStatusValue, ledgerFilters.checkStatus) &&
        matchesSelected(descriptionValue, ledgerFilters.description)
      );
    });
  }, [ledger, ledgerFilters]);

  // اگر سند بازشده دیگر در لیست فیلترشده نبود، پنل عطف را ببند
  useEffect(() => {
    if (!expandedSource) return;

    const stillVisible = filteredLedger.some((row) => {
      if (expandedSource.type === "payment") {
        return (
          row.payment?.id === expandedSource.id &&
          row.documentType === "سند پرداختی"
        );
      }
      return (
        row.marketingId === expandedSource.id &&
        row.documentType === "مارکتینگ"
      );
    });

    if (!stillVisible) {
      setExpandedSource(null);
      setAllocationDrafts({});
    }
  }, [expandedSource, filteredLedger]);

  // ---- allocation functions ----

  // دریافت مبلغ و شناسه سند مبدأ (پرداخت یا مارکتینگ)
  function getSourceInfo(row: LedgerRow): {
    type: "payment" | "marketing";
    id: string;
    amount: number;
    customerId: string;
  } | null {
    if (row.documentType === "سند پرداختی" && row.payment) {
      return {
        type: "payment",
        id: row.payment.id,
        amount: row.payment.amount,
        customerId: row.payment.customer_id || row.sourceCustomerId || customerId,
      };
    }
    if (row.documentType === "مارکتینگ" && row.marketingId) {
      return {
        type: "marketing",
        id: row.marketingId,
        amount: Math.abs(row.amount),
        customerId: row.sourceCustomerId || customerId,
      };
    }
    return null;
  }

  function getSourceAllocated(sourceType: "payment" | "marketing", sourceId: string): number {
    if (sourceType === "payment") {
      return paymentAllocationMap[sourceId] || 0;
    }
    return marketingAllocationMap[sourceId] || 0;
  }

  function expandRow(row: LedgerRow) {
    const source = getSourceInfo(row);
    if (!source) return;

    const key = `${source.type}:${source.id}`;
    const currentKey = expandedSource
      ? `${expandedSource.type}:${expandedSource.id}`
      : null;

    if (currentKey === key) {
      setExpandedSource(null);
      setAllocationDrafts({});
      return;
    }

    // پیش‌پر کردن درفت‌ها با عطف‌های موجود
    const drafts: Record<string, string> = {};
    for (const order of orders) {
      const existing = allocations.find((a) => {
        if (source.type === "payment") {
          return a.payment_id === source.id && a.order_id === order.id;
        }
        return a.marketing_id === source.id && a.order_id === order.id;
      });
      if (existing) {
        drafts[order.id] = formatInputMoney(String(existing.amount));
      }
    }
    setAllocationDrafts(drafts);
    setExpandedSource({ type: source.type, id: source.id });
  }

  function autoAllocate(row: LedgerRow) {
    const source = getSourceInfo(row);
    if (!source) return;

    // عطف‌های موجود این سند
    const existingMap: Record<string, number> = {};
    for (const a of allocations) {
      const matches =
        source.type === "payment"
          ? a.payment_id === source.id
          : a.marketing_id === source.id;
      if (matches) {
        existingMap[a.order_id] = a.amount;
      }
    }

    // مرتب‌سازی سفارش‌ها بر اساس تاریخ تحویل (قدیمی‌ترین اول)
    const sortedOrders = [...orders].sort((a, b) => {
      const aTime = a.delivery_date ? new Date(a.delivery_date).getTime() : 0;
      const bTime = b.delivery_date ? new Date(b.delivery_date).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return String(a.order_number).localeCompare(String(b.order_number));
    });

    let remaining = source.amount;
    const drafts: Record<string, string> = {};

    for (const order of sortedOrders) {
      if (remaining <= 0) break;

      const totalAllocated = orderAllocationMap[order.id] || 0;
      const allocatedByThis = existingMap[order.id] || 0;
      const allocatedByOthers = totalAllocated - allocatedByThis;
      const orderRemaining = Number(order.invoice_total || 0) - allocatedByOthers;

      if (orderRemaining <= 0) continue;

      const allocationAmount = Math.min(remaining, orderRemaining);
      drafts[order.id] = formatInputMoney(String(allocationAmount));
      remaining -= allocationAmount;
    }

    setAllocationDrafts(drafts);
  }

  async function saveAllocations(row: LedgerRow) {
    const source = getSourceInfo(row);
    if (!source) return;

    // تجمیع درفت‌ها
    const newAllocations: Array<{ order_id: string; amount: number }> = [];
    let totalAllocated = 0;

    for (const [orderId, amountStr] of Object.entries(allocationDrafts) as Array<[string, string]>) {
      const amt = Number(normalizeNumber(amountStr));
      if (amt > 0) {
        newAllocations.push({ order_id: orderId, amount: amt });
        totalAllocated += amt;
      }
    }

    if (totalAllocated > source.amount) {
      alert(
        `مجموع عطف‌ها (${money(
          totalAllocated
        )}) بیشتر از مبلغ سند مبدأ (${money(source.amount)}) است.`
      );
      return;
    }

    // اعتبارسنجی مانده فاکتور
    for (const alloc of newAllocations) {
      const order = orders.find((o) => o.id === alloc.order_id);
      if (!order) continue;

      const existingAmount =
        allocations.find((a) => {
          if (source.type === "payment") {
            return a.payment_id === source.id && a.order_id === alloc.order_id;
          }
          return a.marketing_id === source.id && a.order_id === alloc.order_id;
        })?.amount || 0;
      const allocatedByOthers = (orderAllocationMap[alloc.order_id] || 0) - existingAmount;
      const orderRemaining = Number(order.invoice_total || 0) - allocatedByOthers;

      if (alloc.amount > orderRemaining) {
        alert(
          `مبلغ عطف برای سفارش ${order.order_number} بیشتر از مانده فاکتور (${money(
            orderRemaining
          )}) است.`
        );
        return;
      }
    }

    setSavingAllocations(true);

    try {
      // customer_id در payment_allocations باید دقیقاً با مالک سند مبدأ
      // یکسان باشد. در مجموعه‌ها سند پرداخت معمولاً روی مشتری مادر ثبت شده
      // ولی فاکتور روی شعبه قرار دارد؛ بنابراین customer_id را از خود سند مبدأ می‌گیریم.
      const sourceCustomerId = source.customerId;

      let deleteQuery = supabase
        .from("payment_allocations")
        .delete()
        .eq("customer_id", sourceCustomerId);

      if (source.type === "payment") {
        deleteQuery = deleteQuery.eq("payment_id", source.id);
      } else {
        deleteQuery = deleteQuery.eq("marketing_id", source.id);
      }

      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw deleteError;

      // درج عطف‌های جدید
      if (newAllocations.length > 0) {
        const insertPayload = newAllocations.map((a) => ({
          customer_id: sourceCustomerId,
          payment_id: source.type === "payment" ? source.id : null,
          marketing_id: source.type === "marketing" ? source.id : null,
          order_id: a.order_id,
          amount: a.amount,
        }));

        const { error: insertError } = await supabase
          .from("payment_allocations")
          .insert(insertPayload);

        if (insertError) throw insertError;
      }

      // بارگذاری مجدد عطف‌ها
      const { data: allocData, error: allocError } = await supabase
        .from("payment_allocations")
        .select("id,customer_id,payment_id,marketing_id,order_id,amount")
        .eq("customer_id", sourceCustomerId);

      if (allocError) throw allocError;

      setAllocations(
        (allocData || []).map((a: any) => ({
          id: a.id,
          payment_id: a.payment_id || null,
          marketing_id: a.marketing_id || null,
          order_id: a.order_id,
          amount: Number(a.amount || 0),
        }))
      );

      setExpandedSource(null);
      setAllocationDrafts({});

      alert("عطف‌ها با موفقیت ذخیره شد.");
    } catch (error: any) {
      console.error("SAVE ALLOCATIONS ERROR:", error);
      alert(
        `خطا در ذخیره عطف‌ها: ${
          error?.message || "خطای نامشخص"
        }`
      );
    } finally {
      setSavingAllocations(false);
    }
  }

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
    if (!window.confirm("این فایل از سند پرداختی حذف شود؟")) {
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
        `خطا در حذف فایل: ${error?.message || "خطای نامشخص"}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment(row: LedgerRow) {
    if (row.documentType !== "سند پرداختی" || !row.payment) {
      return;
    }

    const confirmed = window.confirm(
      `سند پرداختی شماره ${row.payment.payment_number ?? "-"} حذف شود؟\n\nاین عملیات قابل برگشت نیست.`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const attachmentUrls = row.payment.attachment_urls || [];

      const storagePaths = attachmentUrls
        .map(getStoragePathFromPublicUrl)
        .filter((path): path is string => Boolean(path));

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("payment-attachments")
          .remove(storagePaths);

        if (storageError) throw storageError;
      }

      // حذف عطف‌های این پرداخت (در صورت عدم cascade در دیتابیس)
      const { error: allocDeleteError } = await supabase
        .from("payment_allocations")
        .delete()
        .eq("payment_id", row.payment.id)
        .eq("customer_id", customerId);

      if (allocDeleteError) {
        console.warn(
          "ALLOC DELETE WARNING:",
          allocDeleteError
        );
      }

      const { error: deleteError } = await supabase
        .from("payments")
        .delete()
        .eq("id", row.payment.id)
        .eq("customer_id", customerId);

      if (deleteError) throw deleteError;

      // به‌روزرسانی state
      setAllocations((prev) =>
        prev.filter(
          (a) => a.payment_id !== row.payment!.id
        )
      );

      setLedger((previous) =>
        previous.filter(
          (item) => item.payment?.id !== row.payment!.id
        )
      );

      if (editingPaymentId === row.payment.id) {
        resetForm();
      }

      if (
        expandedSource &&
        expandedSource.type === "payment" &&
        expandedSource.id === row.payment.id
      ) {
        setExpandedSource(null);
        setAllocationDrafts({});
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

    // اگر ویرایش و کاهش مبلغ، بررسی عطف‌های موجود
    if (editingPaymentId) {
      const existingAllocated =
        paymentAllocationMap[editingPaymentId] || 0;
      if (existingAllocated > numericAmount) {
        alert(
          `مبلغ جدید (${money(
            numericAmount
          )}) کمتر از مجموع عطف‌های ثبت‌شده (${money(
            existingAllocated
          )}) است. ابتدا عطف‌ها را اصلاح کنید.`
        );
        return;
      }
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
        const { data: lastPayment } = await supabase
          .from("payments")
          .select("payment_number")
          .eq("customer_id", customerId)
          .order("payment_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextNumber = Number(lastPayment?.payment_number || 0) + 1;

        const { data, error } = await supabase
          .from("payments")
          .insert({
            ...payload,
            payment_number: nextNumber,
            attachment_urls: [],
          })
          .select("id")
          .single();

        if (error) throw error;
        paymentId = data.id;
      }

      if (paymentId && paymentFiles.length) {
        const urls = await uploadPaymentFiles(paymentId);

        const { error: attachmentUpdateError } = await supabase
          .from("payments")
          .update({
            attachment_urls: [...existingAttachments, ...urls],
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

  // ---- helpers for allocation panel ----

  function getOrderAvailable(
    orderId: string,
    sourceType: "payment" | "marketing",
    sourceId: string
  ) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return 0;

    const totalAllocated = orderAllocationMap[orderId] || 0;
    const existingForSource =
      allocations.find((a) => {
        if (sourceType === "payment") {
          return a.payment_id === sourceId && a.order_id === orderId;
        }
        return a.marketing_id === sourceId && a.order_id === orderId;
      })?.amount || 0;
    const allocatedByOthers = totalAllocated - existingForSource;

    return Math.max(0, Number(order.invoice_total || 0) - allocatedByOthers);
  }

  function getDraftTotal(): number {
    return (Object.values(allocationDrafts) as string[]).reduce(
      (sum, val) => sum + Number(normalizeNumber(val) || 0),
      0
    );
  }

  // ---- render ----

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
        @media (max-width: 900px) {
          .finance-summary-grid-2 {
            grid-template-columns: 1fr !important;
          }
        }

        .finance-table th + th,
        .finance-table td + td {
          border-inline-start: 1px solid #e5e7eb;
        }

        .finance-table thead th + th {
          border-inline-start-color: #dbe2ea;
        }
      `}</style>

      {/* ---- sticky header + summary ---- */}
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
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 9,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e3a8a",
            fontSize: 13,
          }}
        >
          تمام سفارش‌ها، پرداختی‌ها و هزینه‌های مارکتینگ شعب این مجموعه در همین
          پرونده مالی تجمیع شده‌اند؛ برای مشتری مادر هیچ سفارش مستقیمی ثبت یا نمایش داده نمی‌شود.
        </div>

        <div style={{ marginBottom: 14 }}>
          <PageHeader
            title={`وضعیت مالی ${groupName || customer.name}`}
            subtitle={
              branchCount > 0
                ? `حساب یکپارچه مجموعه — ${branchCount.toLocaleString("fa-IR")} شعبه`
                : customer.province || "استان ثبت نشده"
            }
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

        {/* ردیف اول خلاصه */}
        <div
          className="finance-summary-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <SummaryCard
            label="مجموع فاکتورها"
            value={money(totals.invoices)}
            color="#0f172a"
          />
          <SummaryCard
            label="مجموع پرداختی"
            value={money(totals.payments)}
            color="#0f172a"
          />
          <SummaryCard
            label="مانده حساب"
            value={
              (totals.balance > 0 ? "- " : totals.balance < 0 ? "+ " : "") +
              money(Math.abs(totals.balance))
            }
            color={
              totals.balance > 0
                ? "#dc2626"
                : totals.balance < 0
                ? "#16a34a"
                : "#475569"
            }
          />
        </div>

        {/* ردیف دوم خلاصه — عطف‌ها */}
        <div
          className="finance-summary-grid-2"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <SummaryCard
            label="عطف‌شده به فاکتورها"
            value={money(totals.totalAllocated)}
            color="#2563eb"
          />
          <SummaryCard
            label="پرداختی عطف‌نشده"
            value={money(totals.unallocated)}
            color={
              totals.unallocated > 0 ? "#f59e0b" : "#475569"
            }
          />
          <SummaryCard
            label="مانده واقعی فاکتورها"
            value={money(totals.invoiceRemaining)}
            color={
              totals.invoiceRemaining > 0 ? "#dc2626" : "#16a34a"
            }
          />
        </div>
      </div>

      {/* ---- payment form ---- */}
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
                setPaymentType(event.target.value as PaymentType)
              }
            >
              <option value="cash">نقدی</option>
              <option value="bank_transfer">واریز بانکی</option>
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
                  onChange={(event) => setBankName(event.target.value)}
                />
              </div>

              <div className="form-field">
                <label>حساب مقصد</label>
                <input
                  className="input"
                  value={destinationAccount}
                  onChange={(event) =>
                    setDestinationAccount(event.target.value)
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
                  <option value="not_due">عدم سررسید</option>
                  <option value="due">سررسید</option>
                  <option value="cleared">وصول شده</option>
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
                      <Paperclip
                        size={14}
                        style={{ verticalAlign: "middle", marginLeft: 6 }}
                      />
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

      {/* ---- order settlement table ---- */}
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
            padding: "0 0 10px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <h3 style={{ margin: 0 }}>وضعیت تسویه فاکتورها</h3>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            {toPersianDigits(filteredOrderSettlements.length)} از {toPersianDigits(orderSettlements.length)} سفارش تحویل‌شده
          </div>
        </div>

        <div style={{ width: "100%", overflowX: "auto" }}>
          <table
            className="finance-table"
            style={{
              width: "max-content",
              minWidth: "100%",
              tableLayout: "fixed",
              borderCollapse: "separate",
              borderSpacing: 0,
            }}
          >
            <colgroup>
              {settlementColumnWidths.map((width, index) => (
                <col key={index} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ background: "#fbfdff" }}>
                <ExcelFilterTh
                  width={settlementColumnWidths[0]}
                  onResize={(delta) => resizeSettlementColumn(0, delta)}
                  label="شماره سفارش"
                  values={settlementFilterValues.orderNumber}
                  selected={settlementFilters.orderNumber}
                  onChange={(value) => setSettlementColumnFilter("orderNumber", value)}
                  open={openSettlementFilter === "orderNumber"}
                  onToggle={() =>
                    setOpenSettlementFilter(
                      openSettlementFilter === "orderNumber" ? null : "orderNumber"
                    )
                  }
                />
                <ExcelFilterTh
                  width={settlementColumnWidths[1]}
                  onResize={(delta) => resizeSettlementColumn(1, delta)}
                  label="شعبه"
                  values={settlementFilterValues.branch}
                  selected={settlementFilters.branch}
                  onChange={(value) => setSettlementColumnFilter("branch", value)}
                  open={openSettlementFilter === "branch"}
                  onToggle={() =>
                    setOpenSettlementFilter(openSettlementFilter === "branch" ? null : "branch")
                  }
                />
                <ExcelFilterTh
                  width={settlementColumnWidths[2]}
                  onResize={(delta) => resizeSettlementColumn(2, delta)}
                  label="تاریخ تحویل"
                  values={settlementFilterValues.deliveryDate}
                  selected={settlementFilters.deliveryDate}
                  onChange={(value) => setSettlementColumnFilter("deliveryDate", value)}
                  open={openSettlementFilter === "deliveryDate"}
                  onToggle={() =>
                    setOpenSettlementFilter(
                      openSettlementFilter === "deliveryDate" ? null : "deliveryDate"
                    )
                  }
                />
                <ExcelFilterTh
                  width={settlementColumnWidths[3]}
                  onResize={(delta) => resizeSettlementColumn(3, delta)}
                  label="موعد تسویه"
                  values={settlementFilterValues.settlementDueDate}
                  selected={settlementFilters.settlementDueDate}
                  onChange={(value) =>
                    setSettlementColumnFilter("settlementDueDate", value)
                  }
                  open={openSettlementFilter === "settlementDueDate"}
                  onToggle={() =>
                    setOpenSettlementFilter(
                      openSettlementFilter === "settlementDueDate"
                        ? null
                        : "settlementDueDate"
                    )
                  }
                />
                <ExcelFilterTh
                  width={settlementColumnWidths[4]}
                  onResize={(delta) => resizeSettlementColumn(4, delta)}
                  label="مبلغ فاکتور"
                  values={settlementFilterValues.invoiceTotal}
                  selected={settlementFilters.invoiceTotal}
                  onChange={(value) => setSettlementColumnFilter("invoiceTotal", value)}
                  open={openSettlementFilter === "invoiceTotal"}
                  onToggle={() =>
                    setOpenSettlementFilter(
                      openSettlementFilter === "invoiceTotal" ? null : "invoiceTotal"
                    )
                  }
                />
                <ExcelFilterTh
                  width={settlementColumnWidths[5]}
                  onResize={(delta) => resizeSettlementColumn(5, delta)}
                  label="پرداخت‌شده"
                  values={settlementFilterValues.paid}
                  selected={settlementFilters.paid}
                  onChange={(value) => setSettlementColumnFilter("paid", value)}
                  open={openSettlementFilter === "paid"}
                  onToggle={() =>
                    setOpenSettlementFilter(openSettlementFilter === "paid" ? null : "paid")
                  }
                />
                <ExcelFilterTh
                  width={settlementColumnWidths[6]}
                  onResize={(delta) => resizeSettlementColumn(6, delta)}
                  label="مانده"
                  values={settlementFilterValues.remaining}
                  selected={settlementFilters.remaining}
                  onChange={(value) => setSettlementColumnFilter("remaining", value)}
                  open={openSettlementFilter === "remaining"}
                  onToggle={() =>
                    setOpenSettlementFilter(
                      openSettlementFilter === "remaining" ? null : "remaining"
                    )
                  }
                />
                <ExcelFilterTh
                  width={settlementColumnWidths[7]}
                  onResize={(delta) => resizeSettlementColumn(7, delta)}
                  label="روز مانده به تسویه"
                  values={settlementFilterValues.daysToSettlement}
                  selected={settlementFilters.daysToSettlement}
                  onChange={(value) =>
                    setSettlementColumnFilter("daysToSettlement", value)
                  }
                  open={openSettlementFilter === "daysToSettlement"}
                  onToggle={() =>
                    setOpenSettlementFilter(
                      openSettlementFilter === "daysToSettlement"
                        ? null
                        : "daysToSettlement"
                    )
                  }
                />
                <ExcelFilterTh
                  width={settlementColumnWidths[8]}
                  onResize={(delta) => resizeSettlementColumn(7, delta)}
                  label="پیشرفت تسویه"
                  values={settlementFilterValues.progress}
                  selected={settlementFilters.progress}
                  onChange={(value) => setSettlementColumnFilter("progress", value)}
                  open={openSettlementFilter === "progress"}
                  onToggle={() =>
                    setOpenSettlementFilter(
                      openSettlementFilter === "progress" ? null : "progress"
                    )
                  }
                />
                <ExcelFilterTh
                  width={settlementColumnWidths[9]}
                  onResize={(delta) => resizeSettlementColumn(9, delta)}
                  label="وضعیت"
                  values={settlementFilterValues.status}
                  selected={settlementFilters.status}
                  onChange={(value) => setSettlementColumnFilter("status", value)}
                  open={openSettlementFilter === "status"}
                  onToggle={() =>
                    setOpenSettlementFilter(openSettlementFilter === "status" ? null : "status")
                  }
                />
              </tr>
            </thead>
            <tbody>
              {filteredOrderSettlements.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{ textAlign: "center", padding: 30 }}
                  >
                    سفارش تحویل‌شده‌ای وجود ندارد.
                  </td>
                </tr>
              ) : (
                filteredOrderSettlements.map((order) => {
                  const meta = SETTLEMENT_META[order.status];
                  return (
                    <tr
                      key={order.id}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <td style={{ padding: "10px", fontWeight: 600 }}>
                        {toPersianDigits(order.order_number)}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          fontWeight: 700,
                          color:
                            order.customer_id === customer?.id
                              ? "#1d4ed8"
                              : "#334155",
                        }}
                      >
                        {order.branch_name || "-"}
                      </td>
                      <td style={{ padding: "10px" }}>
                        {formatWarehouseDeliveryDate(order.delivery_date)}
                      </td>
                      <td style={{ padding: "10px" }}>{formatSettlementDueDate(order.settlement_due_date)}</td>
                      <td
                        style={{
                          padding: "10px",
                          fontWeight: 700,
                          direction: "ltr",
                          textAlign: "right",
                          color: "#b91c1c",
                        }}
                      >
                        {money(order.invoice_total)}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          fontWeight: 700,
                          direction: "ltr",
                          textAlign: "right",
                          color: "#15803d",
                        }}
                      >
                        {money(order.paid)}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          fontWeight: 700,
                          direction: "ltr",
                          textAlign: "right",
                          color:
                            order.remaining > 0
                              ? "#dc2626"
                              : "#16a34a",
                        }}
                      >
                        {money(order.remaining)}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          fontWeight: 800,
                          direction: "ltr",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                          color:
                            order.daysToSettlement === null
                              ? "#94a3b8"
                              : order.daysToSettlement < 0
                              ? "#dc2626"
                              : order.daysToSettlement === 0
                              ? "#d97706"
                              : "#15803d",
                        }}
                      >
                        {order.daysToSettlement === null
                          ? "-"
                          : toPersianDigits(order.daysToSettlement)}
                        {order.daysToSettlement !== null ? " روز" : ""}
                      </td>
                      <td style={{ padding: "10px", minWidth: 120 }}>
                        <div
                          style={{
                            width: "100%",
                            height: 8,
                            background: "#f1f5f9",
                            borderRadius: 4,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${order.progress}%`,
                              height: "100%",
                              background:
                                order.status === "settled"
                                  ? "#22c55e"
                                  : order.status === "partial"
                                  ? "#f59e0b"
                                  : "#ef4444",
                              borderRadius: 4,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#64748b",
                            marginTop: 3,
                          }}
                        >
                          {toPersianDigits(
                            Math.round(order.progress)
                          )}
                          ٪
                        </div>
                      </td>
                      <td style={{ padding: "10px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            background: meta.background,
                            color: meta.color,
                          }}
                        >
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- ledger table ---- */}
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
          <h3 style={{ margin: 0 }}>گردش حساب مشتری</h3>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            نمایش {toPersianDigits(filteredLedger.length)} سند از{" "}
            {toPersianDigits(ledger.length)}
          </div>
        </div>

        <div style={{ width: "100%", overflowX: "auto" }}>
          <table
            className="finance-table"
            style={{
              width: "max-content",
              minWidth: "100%",
              tableLayout: "fixed",
              borderCollapse: "separate",
              borderSpacing: 0,
            }}
          >
            <colgroup>
              {ledgerColumnWidths.map((width, index) => (
                <col key={index} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ background: "#fbfdff" }}>
                <ExcelFilterTh
                  width={ledgerColumnWidths[0]}
                  onResize={(delta) => resizeLedgerColumn(0, delta)}
                  label="شماره سند"
                  values={ledgerFilterValues.documentNumber}
                  selected={ledgerFilters.documentNumber}
                  onChange={(value) => setLedgerColumnFilter("documentNumber", value)}
                  open={openLedgerFilter === "documentNumber"}
                  onToggle={() =>
                    setOpenLedgerFilter(
                      openLedgerFilter === "documentNumber" ? null : "documentNumber"
                    )
                  }
                />
                <ExcelFilterTh
                  width={ledgerColumnWidths[1]}
                  onResize={(delta) => resizeLedgerColumn(1, delta)}
                  label="نوع سند"
                  values={ledgerFilterValues.documentType}
                  selected={ledgerFilters.documentType}
                  onChange={(value) => setLedgerColumnFilter("documentType", value)}
                  open={openLedgerFilter === "documentType"}
                  onToggle={() =>
                    setOpenLedgerFilter(
                      openLedgerFilter === "documentType" ? null : "documentType"
                    )
                  }
                />
                <ExcelFilterTh
                  width={ledgerColumnWidths[2]}
                  onResize={(delta) => resizeLedgerColumn(2, delta)}
                  label="مبلغ"
                  values={ledgerFilterValues.amount}
                  selected={ledgerFilters.amount}
                  onChange={(value) => setLedgerColumnFilter("amount", value)}
                  open={openLedgerFilter === "amount"}
                  onToggle={() =>
                    setOpenLedgerFilter(openLedgerFilter === "amount" ? null : "amount")
                  }
                />
                <ExcelFilterTh
                  width={ledgerColumnWidths[3]}
                  onResize={(delta) => resizeLedgerColumn(3, delta)}
                  label="تاریخ تحویل سفارش"
                  values={ledgerFilterValues.date}
                  selected={ledgerFilters.date}
                  onChange={(value) => setLedgerColumnFilter("date", value)}
                  open={openLedgerFilter === "date"}
                  onToggle={() =>
                    setOpenLedgerFilter(openLedgerFilter === "date" ? null : "date")
                  }
                />
                <ExcelFilterTh
                  width={ledgerColumnWidths[4]}
                  onResize={(delta) => resizeLedgerColumn(4, delta)}
                  label="موعد تسویه فاکتور"
                  values={ledgerFilterValues.settlementDueDate}
                  selected={ledgerFilters.settlementDueDate}
                  onChange={(value) => setLedgerColumnFilter("settlementDueDate", value)}
                  open={openLedgerFilter === "settlementDueDate"}
                  onToggle={() =>
                    setOpenLedgerFilter(
                      openLedgerFilter === "settlementDueDate"
                        ? null
                        : "settlementDueDate"
                    )
                  }
                />
                <ExcelFilterTh
                  width={ledgerColumnWidths[5]}
                  onResize={(delta) => resizeLedgerColumn(5, delta)}
                  label="وضعیت"
                  values={ledgerFilterValues.checkStatus}
                  selected={ledgerFilters.checkStatus}
                  onChange={(value) => setLedgerColumnFilter("checkStatus", value)}
                  open={openLedgerFilter === "checkStatus"}
                  onToggle={() =>
                    setOpenLedgerFilter(
                      openLedgerFilter === "checkStatus" ? null : "checkStatus"
                    )
                  }
                />
                <Th
                  width={ledgerColumnWidths[6]}
                  onResize={(delta) => resizeLedgerColumn(6, delta)}
                >
                  عملیات
                </Th>
                <ExcelFilterTh
                  label="توضیحات"
                  values={ledgerFilterValues.description}
                  selected={ledgerFilters.description}
                  onChange={(value) => setLedgerColumnFilter("description", value)}
                  open={openLedgerFilter === "description"}
                  onToggle={() =>
                    setOpenLedgerFilter(
                      openLedgerFilter === "description" ? null : "description"
                    )
                  }
                  width={ledgerColumnWidths[7]}
                  onResize={(delta) => resizeLedgerColumn(7, delta)}
                />
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      textAlign: "center",
                      padding: 30,
                    }}
                  >
                    هنوز سندی برای این مشتری ثبت نشده است.
                  </td>
                </tr>
              ) : (
                filteredLedger.flatMap((row) => {
                  const rows: ReactElement[] = [];

                  // ---- main row ----
                  rows.push(
                    <tr key={row.id}>
                      <td style={{ padding: "10px" }}>
                        {toPersianDigits(row.documentNumber || "-")}
                      </td>

                      <td style={{ padding: "10px" }}>
                        {row.documentType}
                        {row.paymentType
                          ? ` - ${paymentLabels[row.paymentType]}`
                          : ""}
                      </td>

                      <td
                        style={{
                          padding: "10px",
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

                      <td style={{ padding: "10px" }}>
                        {row.documentType === "سفارش" ? faDate(row.deliveryDate || null) : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>

                      <td style={{ padding: "10px" }}>
                        {row.documentType === "سفارش" ? faDate(row.settlementDueDate || null) : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>

                      <td style={{ padding: "10px" }}>
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

                      <td style={{ padding: "10px" }}>
                        {row.documentType === "سند پرداختی" ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                              gap: 4,
                              width: 154,
                              maxWidth: "100%",
                              margin: "0 auto",
                              alignItems: "center",
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={() => openEditPayment(row)}
                              style={{ padding: "3px 4px", fontSize: 10, lineHeight: 1, whiteSpace: "nowrap", minWidth: 0, width: "100%", justifyContent: "center" }}
                              disabled={saving}
                            >
                              ویرایش
                            </button>

                            {/* دکمه عطف به فاکتور */}
                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={() => expandRow(row)}
                              style={{ padding: "4px 6px", fontSize: 11, lineHeight: 1, whiteSpace: "nowrap", color: "#2563eb", borderColor: expandedSource?.type === "payment" && expandedSource.id === row.payment?.id ? "#2563eb" : undefined, background: expandedSource?.type === "payment" && expandedSource.id === row.payment?.id ? "#eff6ff" : undefined }}
                              disabled={saving}
                              title="عطف پرداخت به فاکتورها"
                            >
                              <Link2 size={14} />
                              عطف
                              {row.payment &&
                                (paymentAllocationMap[row.payment.id] || 0) > 0 && (
                                  <span
                                    style={{
                                      marginRight: 4,
                                      fontSize: 10,
                                      color: "#2563eb",
                                      fontWeight: 700,
                                      background: "#eff6ff",
                                      padding: "1px 5px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    {toPersianDigits(
                                      new Intl.NumberFormat("fa-IR").format(
                                        paymentAllocationMap[row.payment.id]
                                      )
                                    )} ر
                                  </span>
                                )}
                              <ChevronDown
                                size={12}
                                style={{
                                  transition: "transform 0.2s",
                                  transform:
                                    expandedSource?.type === "payment" &&
                                    expandedSource.id === row.payment?.id
                                      ? "rotate(180deg)"
                                      : "none",
                                }}
                              />
                            </button>

                            {row.payment?.attachment_urls?.length ? (
                              <>
                                {row.payment.attachment_urls.map((url, index) => (
                                  <a
                                    key={`${row.payment!.id}-attachment-${index}`}
                                    className="btn btn-secondary btn-small"
                                    href={url}
                                    style={{ padding: "3px 4px", fontSize: 9, lineHeight: 1, whiteSpace: "nowrap", minWidth: 0, width: "100%", justifyContent: "center" }}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={`باز کردن فایل ${index + 1}`}
                                  >
                                    <Paperclip size={14} />
                                    فایل {toPersianDigits(index + 1)}
                                  </a>
                                ))}
                              </>
                            ) : null}

                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={() => deletePayment(row)}
                              style={{ padding: "3px 4px", fontSize: 10, lineHeight: 1, whiteSpace: "nowrap", color: "#b91c1c", minWidth: 0, width: "100%", justifyContent: "center" }}
                              disabled={saving}
                              title="حذف سند پرداختی"
                            >
                              <Trash2 size={14} />
                              حذف
                            </button>
                          </div>
                        ) : row.documentType === "مارکتینگ" && row.marketingId ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                              gap: 4,
                              width: 154,
                              maxWidth: "100%",
                              margin: "0 auto",
                              alignItems: "center",
                            }}
                          >
                            {/* دکمه عطف مارکتینگ به فاکتور */}
                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={() => expandRow(row)}
                              disabled={saving}
                              title="عطف هزینه مارکتینگ به فاکتورها"
                              style={{
                                color: "#7c3aed",
                                borderColor:
                                  expandedSource?.type === "marketing" &&
                                  expandedSource.id === row.marketingId
                                    ? "#7c3aed"
                                    : undefined,
                                background:
                                  expandedSource?.type === "marketing" &&
                                  expandedSource.id === row.marketingId
                                    ? "#f5f3ff"
                                    : undefined,
                              }}
                            >
                              <Link2 size={14} />
                              عطف
                              {(marketingAllocationMap[row.marketingId] || 0) > 0 && (
                                <span
                                  style={{
                                    marginRight: 4,
                                    fontSize: 10,
                                    color: "#7c3aed",
                                    fontWeight: 700,
                                    background: "#f5f3ff",
                                    padding: "1px 5px",
                                    borderRadius: 4,
                                  }}
                                >
                                  {toPersianDigits(
                                    new Intl.NumberFormat("fa-IR").format(
                                      marketingAllocationMap[row.marketingId]
                                    )
                                  )} ر
                                </span>
                              )}
                              <ChevronDown
                                size={12}
                                style={{
                                  transition: "transform 0.2s",
                                  transform:
                                    expandedSource?.type === "marketing" &&
                                    expandedSource.id === row.marketingId
                                      ? "rotate(180deg)"
                                      : "none",
                                }}
                              />
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: "10px" }}>
                        {row.description || "—"}
                      </td>
                    </tr>
                  );

                  // ---- expanded allocation panel ----
                  const source = getSourceInfo(row);
                  const isExpanded =
                    source &&
                    expandedSource &&
                    expandedSource.type === source.type &&
                    expandedSource.id === source.id;

                  if (source && isExpanded) {
                    const sourceAmount = source.amount;
                    const allocatedAmount = getSourceAllocated(source.type, source.id);
                    const draftTotal = getDraftTotal();
                    const draftUnallocated = sourceAmount - draftTotal;
                    const isPayment = source.type === "payment";
                    const sourceLabel = isPayment ? "پرداخت" : "هزینه مارکتینگ";
                    const headerColor = isPayment ? "#2563eb" : "#7c3aed";
                    const headerBg = isPayment ? "#f0f9ff" : "#f5f3ff";
                    const headerText = isPayment ? "#1e40af" : "#5b21b6";

                    // سفارش‌هایی که قابل عطف هستند (مانده دارند یا عطف موجود دارند)
                    const allocatableOrders = orders.filter((order) => {
                      const available = getOrderAvailable(
                        order.id,
                        source.type,
                        source.id
                      );
                      const hasDraft =
                        Number(normalizeNumber(allocationDrafts[order.id] || "")) > 0;
                      return available > 0 || hasDraft;
                    });

                    rows.push(
                      <tr
                        key={`${row.id}-alloc`}
                        style={{ background: "#f8fafc" }}
                      >
                        <td colSpan={8} style={{ padding: "12px 16px" }}>
                          <div
                            style={{
                              border: "1px solid #e2e8f0",
                              borderRadius: 12,
                              background: "#ffffff",
                              overflow: "hidden",
                            }}
                          >
                            {/* هدر پنل */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                flexWrap: "wrap",
                                padding: "12px 16px",
                                background: headerBg,
                                borderBottom: "1px solid #e2e8f0",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <Link2 size={16} style={{ color: headerColor }} />
                                <strong style={{ color: headerText }}>
                                  عطف {sourceLabel} به فاکتورها
                                </strong>
                                <span
                                  style={{
                                    color: "#64748b",
                                    fontSize: 12,
                                  }}
                                >
                                  مبلغ {sourceLabel}: {money(sourceAmount)}
                                </span>
                                <span
                                  style={{
                                    color: "#2563eb",
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  عطف‌شده: {money(allocatedAmount)}
                                </span>
                                <span
                                  style={{
                                    color: draftUnallocated < 0 ? "#dc2626" : "#f59e0b",
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  مانده قابل عطف: {money(Math.abs(draftUnallocated))}
                                  {draftUnallocated < 0 && " (بیشتر از مبلغ!)"}
                                </span>
                              </div>

                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => autoAllocate(row)}
                                disabled={savingAllocations}
                                title="توزیع خودکار بر اساس قدیمی‌ترین فاکتورها (FIFO)"
                                style={{ color: headerColor }}
                              >
                                <Zap size={14} />
                                عطف خودکار
                              </button>
                            </div>

                            {/* جدول عطف */}
                            {allocatableOrders.length === 0 ? (
                              <div
                                style={{
                                  padding: 24,
                                  textAlign: "center",
                                  color: "#64748b",
                                  fontSize: 13,
                                }}
                              >
                                سفارش تحویل‌شده‌ای با مانده برای عطف وجود ندارد.
                              </div>
                            ) : (
                              <div
                                style={{
                                  width: "100%",
                                  overflowX: "auto",
                                }}
                              >
                                <table
            className="finance-table"
                                  style={{
                                    width: "100%",
                                    borderCollapse: "separate",
                                    borderSpacing: 0,
                                    fontSize: 13,
                                  }}
                                >
                                  <thead>
                                    <tr
                                      style={{
                                        background: "#f8fafc",
                                        borderBottom: "1px solid #e2e8f0",
                                      }}
                                    >
                                      <Th>شماره سفارش</Th>
                                      <Th>مبلغ فاکتور</Th>
                                      <Th>عطف‌شده (سایر پرداخت‌ها)</Th>
                                      <Th>مانده قابل عطف</Th>
                                      <Th>مبلغ عطف این پرداخت</Th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {allocatableOrders.map((order) => {
                                      const available =
                                        getOrderAvailable(
                                          order.id,
                                          source.type,
                                          source.id
                                        );
                                      const draftVal =
                                        allocationDrafts[order.id] || "";
                                      const draftNum = Number(
                                        normalizeNumber(draftVal) || 0
                                      );
                                      const exceeds =
                                        draftNum > available;

                                      return (
                                        <tr
                                          key={order.id}
                                          style={{
                                            borderBottom: "1px solid #f1f5f9",
                                          }}
                                        >
                                          <td
                                            style={{
                                              padding: "8px 10px",
                                              fontWeight: 600,
                                            }}
                                          >
                                            {toPersianDigits(
                                              order.order_number
                                            )}
                                          </td>
                                          <td
                                            style={{
                                              padding: "8px 10px",
                                              direction: "ltr",
                                              textAlign: "right",
                                              color: "#475569",
                                            }}
                                          >
                                            {money(order.invoice_total)}
                                          </td>
                                          <td
                                            style={{
                                              padding: "8px 10px",
                                              direction: "ltr",
                                              textAlign: "right",
                                              color: "#64748b",
                                            }}
                                          >
                                            {money(
                                              (orderAllocationMap[order.id] || 0) -
                                                (allocations.find(
                                                  (a) =>
                                                    ((source.type === "payment" &&
                                                      a.payment_id === source.id) ||
                                                      (source.type === "marketing" &&
                                                        a.marketing_id === source.id)) &&
                                                    a.order_id === order.id
                                                )?.amount || 0)
                                            )}
                                          </td>
                                          <td
                                            style={{
                                              padding: "8px 10px",
                                              direction: "ltr",
                                              textAlign: "right",
                                              fontWeight: 700,
                                              color:
                                                available > 0
                                                  ? "#15803d"
                                                  : "#94a3b8",
                                            }}
                                          >
                                            {money(available)}
                                          </td>
                                          <td style={{ padding: "8px 10px" }}>
                                            <input
                                              className="input"
                                              inputMode="numeric"
                                              value={draftVal}
                                              onChange={(event) =>
                                                setAllocationDrafts(
                                                  (prev) => ({
                                                    ...prev,
                                                    [order.id]:
                                                      formatInputMoney(
                                                        event.target.value
                                                      ),
                                                  })
                                                )
                                              }
                                              placeholder="۰"
                                              style={{
                                                width: 140,
                                                fontSize: 13,
                                                direction: "ltr",
                                                textAlign: "right",
                                                borderColor: exceeds
                                                  ? "#ef4444"
                                                  : draftNum > 0
                                                  ? "#22c55e"
                                                  : undefined,
                                                background: exceeds
                                                  ? "#fef2f2"
                                                  : undefined,
                                              }}
                                            />
                                            {exceeds && (
                                              <div
                                                style={{
                                                  fontSize: 11,
                                                  color: "#ef4444",
                                                  marginTop: 2,
                                                }}
                                              >
                                                بیشتر از مانده!
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* دکمه‌های پنل */}
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                padding: "12px 16px",
                                borderTop: "1px solid #f1f5f9",
                                background: "#f8fafc",
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => saveAllocations(row)}
                                disabled={
                                  savingAllocations ||
                                  draftUnallocated < 0
                                }
                                style={{
                                  background:
                                    draftUnallocated < 0
                                      ? "#94a3b8"
                                      : undefined,
                                }}
                              >
                                <Save size={16} />
                                {savingAllocations
                                  ? "در حال ذخیره..."
                                  : "ذخیره عطف‌ها"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                  setExpandedSource(null);
                                  setAllocationDrafts({});
                                }}
                                disabled={savingAllocations}
                              >
                                انصراف
                              </button>
                              <div
                                style={{
                                  marginRight: "auto",
                                  display: "flex",
                                  gap: 16,
                                  alignItems: "center",
                                  fontSize: 12,
                                }}
                              >
                                <span style={{ color: "#64748b" }}>
                                  جمع عطف:{" "}
                                  <strong
                                    style={{
                                      color:
                                        draftUnallocated < 0
                                          ? "#dc2626"
                                          : "#2563eb",
                                    }}
                                  >
                                    {money(draftTotal)}
                                  </strong>
                                </span>
                                <span style={{ color: "#64748b" }}>
                                  مانده {sourceLabel}:{" "}
                                  <strong
                                    style={{
                                      color:
                                        draftUnallocated < 0
                                          ? "#dc2626"
                                          : "#f59e0b",
                                    }}
                                  >
                                    {money(Math.abs(draftUnallocated))}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return rows;
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

// ---- helper components ----

function ExcelFilterTh({
  label,
  values,
  selected,
  onChange,
  open,
  onToggle,
  width = 150,
  onResize,
}: {
  label: string;
  values: string[];
  selected: FilterSelection;
  onChange: (value: FilterSelection) => void;
  open: boolean;
  onToggle: () => void;
  width?: number;
  onResize?: (delta: number) => void;
}) {
  return (
    <th
      style={{
        position: "relative",
        color: "#475569",
        fontSize: 12,
        fontWeight: 700,
        padding: "8px 10px",
        minWidth: width,
        textAlign: "right",
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <span>{label}</span>
        <button
          type="button"
          onClick={onToggle}
          title={`فیلتر ${label}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 7,
            border:
              selected !== null && selected.length < values.length
                ? "1px solid #2563eb"
                : "1px solid #cbd5e1",
            background:
              selected !== null && selected.length < values.length
                ? "#eff6ff"
                : "#ffffff",
            color:
              selected !== null && selected.length < values.length
                ? "#2563eb"
                : "#475569",
            cursor: "pointer",
          }}
        >
          <Filter size={14} />
        </button>
      </div>

      {open && (
        <ExcelFilterDropdown
          values={values}
          selected={selected}
          onChange={onChange}
          onClose={onToggle}
        />
      )}

      {onResize && <ColumnResizeHandle onResize={onResize} />}
    </th>
  );
}

function ExcelFilterDropdown({
  values,
  selected,
  onChange,
  onClose,
}: {
  values: string[];
  selected: FilterSelection;
  onChange: (value: FilterSelection) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const visibleValues = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("fa");
    if (!q) return values;
    return values.filter((value) =>
      value.toLocaleLowerCase("fa").includes(q)
    );
  }, [values, search]);

  const allSelected = selected === null || values.every((value) => selected.includes(value));

  function toggleValue(value: string) {
    if (selected === null) {
      const next = values.filter((item) => item !== value);
      onChange(next.length === values.length ? null : next);
      return;
    }

    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];

    onChange(next.length === values.length ? null : next);
  }

  function toggleVisibleValues() {
    if (selected === null) {
      onChange(values.filter((value) => !visibleValues.includes(value)));
      return;
    }

    const visibleSet = new Set(visibleValues);
    const everyVisibleSelected = visibleValues.every((value) => selected.includes(value));

    if (everyVisibleSelected) {
      const next = selected.filter((value) => !visibleSet.has(value));
      onChange(next.length === values.length ? null : next);
    } else {
      const merged = Array.from(new Set([...selected, ...visibleValues]));
      onChange(merged.length === values.length ? null : merged);
    }
  }

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 4,
        zIndex: 200,
        width: 285,
        maxHeight: 360,
        padding: 10,
        borderRadius: 10,
        background: "#ffffff",
        border: "1px solid #cbd5e1",
        boxShadow: "0 14px 35px rgba(15,23,42,.18)",
        textAlign: "right",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8 }}>
        فیلتر {toPersianDigits(values.length)} مقدار
      </div>

      <input
        className="input"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="جستجو در مقادیر..."
        style={{ width: "100%", fontSize: 12, marginBottom: 8 }}
        autoFocus
      />

      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={toggleVisibleValues}
          style={{ flex: 1 }}
        >
          {allSelected ? "لغو انتخاب موارد نمایش‌داده‌شده" : "انتخاب موارد نمایش‌داده‌شده"}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => onChange(null)}
        >
          همه
        </button>
      </div>

      <div
        style={{
          maxHeight: 220,
          overflowY: "auto",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: 5,
        }}
      >
        {visibleValues.length === 0 ? (
          <div style={{ padding: 12, textAlign: "center", color: "#64748b", fontSize: 12 }}>
            مقداری پیدا نشد.
          </div>
        ) : (
          visibleValues.map((value) => {
            const checked = selected === null || selected.includes(value);
            return (
              <label
                key={value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 6px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleValue(value)}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {value}
                </span>
              </label>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => onChange(null)}
          style={{ flex: 1 }}
        >
          پاک کردن فیلتر
        </button>
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={onClose}
          style={{ flex: 1 }}
        >
          بستن
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
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
        {label}
      </div>
      <strong
        style={{
          fontSize: 20,
          fontWeight: 800,
          color,
          direction: "ltr",
          display: "block",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function Th({
  children,
  width,
  onResize,
}: {
  children: ReactNode;
  width?: number;
  onResize?: (delta: number) => void;
}) {
  return (
    <th
      style={{
        position: "relative",
        color: "#475569",
        fontSize: 12,
        fontWeight: 700,
        padding: "12px 10px",
        width,
        minWidth: width,
        maxWidth: width,
        whiteSpace: "nowrap",
      }}
    >
      {children}
      {onResize && <ColumnResizeHandle onResize={onResize} />}
    </th>
  );
}

function ColumnResizeHandle({
  onResize,
}: {
  onResize: (delta: number) => void;
}) {
  function handleMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      if (delta !== 0) {
        onResize(delta);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <div
      role="separator"
      aria-label="تغییر عرض ستون"
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 7,
        cursor: "col-resize",
        zIndex: 10,
      }}
      title="برای تغییر عرض ستون بکشید"
    />
  );
}
