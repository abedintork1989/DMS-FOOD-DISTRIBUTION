"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Edit3,
  Filter,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  UserCheck,
  UserX,
  X,
} from "lucide-react";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  active: boolean | null;
};

type Territory = {
  id?: string;
  province: string;
  region: string;
  active: boolean;
  valid_from: string;
  valid_to: string;
};

type Visitor = {
  id: string;
  profile_id: string | null;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  employee_code: string | null;
  gender: "male" | "female" | "other" | null;
  birth_date: string | null;
  residential_address: string | null;
  residential_province: string | null;
  residential_city: string | null;
  active: boolean;
  tracking_enabled: boolean;
  created_at: string;
  updated_at: string;
  territories: Territory[];
};

type VisitorForm = {
  full_name: string;
  phone: string;
  avatar_url: string;
  profile_id: string;
  employee_code: string;
  gender: "male" | "female" | "other" | "";
  birth_date: string;
  residential_address: string;
  residential_province: string;
  residential_city: string;
  active: boolean;
  tracking_enabled: boolean;
  territories: Territory[];
};

const emptyTerritory = (): Territory => ({
  province: "",
  region: "",
  active: true,
  valid_from: "",
  valid_to: "",
});

const emptyForm: VisitorForm = {
  full_name: "",
  phone: "",
  avatar_url: "",
  profile_id: "",
  employee_code: "",
  gender: "",
  birth_date: "",
  residential_address: "",
  residential_province: "",
  residential_city: "",
  active: true,
  tracking_enabled: false,
  territories: [emptyTerritory()],
};

function calculateAge(value: string | null) {
  if (!value) return null;

  const birth = new Date(`${value}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();

  const monthDiff = now.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getDate() < birth.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

type VisitorTableFilterKey =
  | "full_name"
  | "phone"
  | "province"
  | "region"
  | "age"
  | "tracking"
  | "status";

type VisitorTableFilters = Record<VisitorTableFilterKey, string[]>;

const EMPTY_VISITOR_TABLE_FILTERS: VisitorTableFilters = {
  full_name: [],
  phone: [],
  province: [],
  region: [],
  age: [],
  tracking: [],
  status: [],
};

function normalizedFilterValue(value: string) {
  return value.trim().toLocaleLowerCase("fa-IR");
}

function filterableValue(
  visitor: Visitor,
  key: VisitorTableFilterKey
): string {
  const age = calculateAge(visitor.birth_date);

  switch (key) {
    case "full_name":
      return visitor.full_name || "";
    case "phone":
      return visitor.phone || "";
    case "province":
      return Array.from(
        new Set(
          visitor.territories
            .filter((item) => item.active)
            .map((item) => item.province)
            .filter(Boolean)
        )
      ).join("، ");
    case "region":
      return visitor.territories
        .filter((item) => item.active)
        .map((item) => item.region)
        .filter(Boolean)
        .join("، ");
    case "age":
      return age === null ? "" : `${age}`;
    case "tracking":
      return visitor.tracking_enabled ? "فعال" : "خاموش";
    case "status":
      return visitor.active ? "فعال" : "غیرفعال";
  }
}

function VisitorColumnFilter({
  title,
  values,
  selected,
  onChange,
  formatter,
}: {
  title: string;
  values: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  formatter?: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const uniqueValues = Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "fa"))
    )
  );

  const visibleValues = uniqueValues.filter((value) =>
    normalizedFilterValue(value).includes(
      normalizedFilterValue(search)
    )
  );

  function updateMenuPosition() {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();

    setMenuPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    const handleViewportChange = () => {
      updateMenuPosition();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  const toggleValue = (value: string) => {
    const exists = selected.includes(value);

    onChange(
      exists
        ? selected.filter((item) => item !== value)
        : [...selected, value]
    );
  };

  function selectAllVisible() {
    const merged = Array.from(
      new Set([...selected, ...visibleValues])
    );
    onChange(merged);
  }

  function clearAll() {
    onChange([]);
  }

  const filterMenu =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="بستن فیلتر"
              onClick={() => setOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 99990,
                border: 0,
                background: "transparent",
                cursor: "default",
                padding: 0,
              }}
            />

            <div
              style={{
                position: "fixed",
                top: menuPosition.top,
                left: Math.max(
                  8,
                  Math.min(
                    menuPosition.left,
                    window.innerWidth - menuPosition.width - 8
                  )
                ),
                width: Math.max(140, menuPosition.width),
                maxHeight: 390,
                overflow: "hidden",
                background: "#fff",
                border: "1px solid #dbe3ea",
                borderRadius: 12,
                boxShadow:
                  "0 22px 60px rgba(15,23,42,.24)",
                zIndex: 99999,
                padding: 8,
                textAlign: "right",
              }}
              onClick={(event) =>
                event.stopPropagation()
              }
              dir="rtl"
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "#0f172a",
                  marginBottom: 8,
                }}
              >
                فیلتر {title}
              </div>

              <input
                className="input"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="جستجوی مقدار..."
                style={{
                  width: "100%",
                  marginBottom: 8,
                }}
                autoFocus
              />

              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={selectAllVisible}
                  style={{ flex: 1 }}
                >
                  انتخاب همه
                </button>

                <button
                  type="button"
                  className="btn btn-small"
                  onClick={clearAll}
                  style={{
                    flex: 1,
                    background: "#fff",
                    color: "#b91c1c",
                    border: "1px solid #fecaca",
                  }}
                >
                  پاک کردن
                </button>
              </div>

              <div
                style={{
                  maxHeight: 235,
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: 9,
                  padding: 4,
                  background: "#fff",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "8px 9px",
                    borderRadius: 7,
                    cursor: "pointer",
                    background: "#f8fafc",
                    borderBottom:
                      "1px solid #e2e8f0",
                    marginBottom: 3,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      visibleValues.length > 0 &&
                      visibleValues.every((value) =>
                        selected.includes(value)
                      )
                    }
                    onChange={() => {
                      const allSelected =
                        visibleValues.length > 0 &&
                        visibleValues.every((value) =>
                          selected.includes(value)
                        );

                      if (allSelected) {
                        onChange(
                          selected.filter(
                            (item) =>
                              !visibleValues.includes(
                                item
                              )
                          )
                        );
                      } else {
                        selectAllVisible();
                      }
                    }}
                    style={{
                      width: 15,
                      height: 15,
                      accentColor: "#0f6b43",
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: "#334155",
                      fontWeight: 800,
                    }}
                  >
                    (همه)
                  </span>
                </label>

                {visibleValues.length === 0 ? (
                  <div
                    style={{
                      padding: 18,
                      textAlign: "center",
                      color: "#94a3b8",
                      fontSize: 12,
                    }}
                  >
                    برای این ستون مقدار یکتایی
                    پیدا نشد.
                  </div>
                ) : (
                  visibleValues.map((value) => {
                    const checked =
                      selected.includes(value);

                    return (
                      <label
                        key={value}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          padding: "8px 9px",
                          borderRadius: 7,
                          cursor: "pointer",
                          background: checked
                            ? "#f0fdf4"
                            : "transparent",
                          borderBottom:
                            "1px solid #f1f5f9",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            toggleValue(value)
                          }
                          style={{
                            width: 15,
                            height: 15,
                            accentColor: "#0f6b43",
                          }}
                        />

                        <span
                          style={{
                            flex: 1,
                            fontSize: 12,
                            color: "#334155",
                            fontWeight: checked
                              ? 800
                              : 500,
                          }}
                        >
                          {formatter
                            ? formatter(value)
                            : value}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => setOpen(false)}
                style={{
                  width: "100%",
                  marginTop: 8,
                }}
              >
                بستن
              </button>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <span
        style={{
          position: "relative",
          display: "inline-flex",
        }}
      >
        <button
          ref={buttonRef}
          type="button"
          aria-label={`فیلتر ${title}`}
          title={`فیلتر ${title}`}
          onClick={(event) => {
            event.stopPropagation();

            if (!open) {
              updateMenuPosition();
            }

            setOpen((current) => !current);
          }}
          style={{
            border: 0,
            background: selected.length
              ? "rgba(15,107,67,.10)"
              : "transparent",
            color: selected.length
              ? "#0f6b43"
              : "#64748b",
            width: 30,
            height: 30,
            borderRadius: 8,
            display: "inline-grid",
            placeItems: "center",
            cursor: "pointer",
            marginRight: 4,
          }}
        >
          <Filter size={14} />

          {selected.length > 0 && (
            <span
              style={{
                position: "absolute",
                top: -3,
                right: -3,
                minWidth: 16,
                height: 16,
                borderRadius: 999,
                padding: "0 4px",
                background: "#0f6b43",
                color: "#fff",
                fontSize: 9,
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
              }}
            >
              {selected.length}
            </span>
          )}
        </button>
      </span>

      {filterMenu}
    </>
  );
}

function profileLabel(profile: Profile) {
  return `${profile.full_name || "بدون نام"}${profile.phone ? ` — ${profile.phone}` : ""}`;
}

const IRAN_PROVINCES: Record<string, string[]> = {
  "آذربایجان شرقی": ["تبریز", "مراغه", "مرند", "اهر", "بناب", "میانه", "شبستر", "اسکو"],
  "آذربایجان غربی": ["ارومیه", "خوی", "میاندوآب", "مهاباد", "بوکان", "سلماس", "نقده", "پیرانشهر"],
  "اردبیل": ["اردبیل", "مشگین‌شهر", "خلخال", "پارس‌آباد", "نمین", "گرمی", "نیر", "اصلاندوز"],
  "اصفهان": ["اصفهان", "کاشان", "خمینی‌شهر", "نجف‌آباد", "شاهین‌شهر", "فلاورجان", "شهرضا", "مبارکه"],
  "البرز": ["کرج", "فردیس", "نظرآباد", "ساوجبلاغ", "طالقان", "اشتهارد"],
  "ایلام": ["ایلام", "دهلران", "مهران", "آبدانان", "دره‌شهر", "ایوان", "چرداول"],
  "بوشهر": ["بوشهر", "دشتستان", "دشتی", "گناوه", "کنگان", "عسلویه", "دیلم"],
  "تهران": ["تهران", "ری", "شمیرانات", "شهریار", "اسلامشهر", "قدس", "ملارد", "پاکدشت", "ورامین", "دماوند", "فیروزکوه", "رباط‌کریم", "بهارستان", "پردیس", "قرچک", "پیشوا"],
  "چهارمحال و بختیاری": ["شهرکرد", "بروجن", "فارسان", "لردگان", "اردل", "کوهرنگ", "کیار"],
  "خراسان جنوبی": ["بیرجند", "قائن", "طبس", "فردوس", "نهبندان", "درمیان", "سربیشه"],
  "خراسان رضوی": ["مشهد", "نیشابور", "سبزوار", "تربت‌حیدریه", "تربت‌جام", "قوچان", "چناران", "کاشمر", "گناباد", "فریمان"],
  "خراسان شمالی": ["بجنورد", "شیروان", "اسفراین", "جاجرم", "مانه و سملقان", "فاروج", "گرمه"],
  "خوزستان": ["اهواز", "آبادان", "خرمشهر", "دزفول", "بندر ماهشهر", "بهبهان", "اندیمشک", "شوش", "شوشتر", "ایذه"],
  "زنجان": ["زنجان", "ابهر", "خدابنده", "خرمدره", "طارم", "ماهنشان", "ایجرود"],
  "سمنان": ["سمنان", "شاهرود", "دامغان", "گرمسار", "مهدی‌شهر", "آرادان", "میامی"],
  "سیستان و بلوچستان": ["زاهدان", "چابهار", "ایرانشهر", "زابل", "خاش", "سراوان", "کنارک", "نیک‌شهر"],
  "فارس": ["شیراز", "مرودشت", "کازرون", "جهرم", "فسا", "لار", "داراب", "آباده", "اقلید", "ممسنی"],
  "قزوین": ["قزوین", "تاکستان", "الوند", "آبیک", "بوئین‌زهرا", "آوج"],
  "قم": ["قم", "جعفریه", "کهک", "سلفچگان"],
  "کردستان": ["سنندج", "سقز", "بانه", "مریوان", "قروه", "بیجار", "کامیاران", "دهگلان"],
  "کرمان": ["کرمان", "رفسنجان", "سیرجان", "جیرفت", "بم", "زرند", "کهنوج", "بافت", "راور", "بردسیر"],
  "کرمانشاه": ["کرمانشاه", "اسلام‌آباد غرب", "پاوه", "سرپل ذهاب", "کنگاور", "سنقر", "هرسین", "جوانرود"],
  "کهگیلویه و بویراحمد": ["یاسوج", "دهدشت", "گچساران", "لیکک", "سی‌سخت"],
  "گلستان": ["گرگان", "گنبدکاووس", "علی‌آباد کتول", "آق‌قلا", "بندر ترکمن", "کردکوی", "مینودشت", "کلاله"],
  "گیلان": ["رشت", "بندر انزلی", "لاهیجان", "رودسر", "لنگرود", "آستارا", "تالش", "فومن", "صومعه‌سرا"],
  "لرستان": ["خرم‌آباد", "بروجرد", "الیگودرز", "دورود", "کوهدشت", "نورآباد", "الشتر", "پلدختر"],
  "مازندران": ["ساری", "بابل", "آمل", "قائم‌شهر", "بهشهر", "نوشهر", "چالوس", "تنکابن", "بابلسر", "جویبار"],
  "مرکزی": ["اراک", "ساوه", "خمین", "محلات", "دلیجان", "شازند", "آشتیان", "تفرش"],
  "هرمزگان": ["بندرعباس", "قشم", "کیش", "بندر لنگه", "میناب", "رودان", "حاجی‌آباد", "جاسک"],
  "همدان": ["همدان", "ملایر", "نهاوند", "تویسرکان", "کبودرآهنگ", "رزن", "اسدآباد"],
  "یزد": ["یزد", "میبد", "اردکان", "بافق", "مهریز", "ابرکوه", "تفت", "اشکذر"],
};

const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

function gregorianToJalali(gy: number, gm: number, gd: number) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];

  let jy = -1595 + 33 * Math.floor(days / 12053);
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
  let jy2 = jy + 1595;
  let days =
    -355668 +
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  let gy = 400 * Math.floor(days / 146097);
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
  const sal_a = [
    0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];
  let gm = 0;
  while (gm < 13 && gd > sal_a[gm]) {
    gd -= sal_a[gm];
    gm++;
  }
  return { gy, gm, gd };
}

function jalaliDaysInMonth(year: number, month: number) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return ((year - 1399) % 4) === 0 ? 30 : 29;
}

function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function parseStoredBirthDate(value: string) {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return gregorianToJalali(
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  );
}

function gregorianValue(gy: number, gm: number, gd: number) {
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

function defaultBirthdayIso() {
  const now = new Date();

  return gregorianValue(
    now.getFullYear() - 30,
    now.getMonth() + 1,
    now.getDate()
  );
}

function PersianDatePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const stored = parseStoredBirthDate(value);
  const fallback = parseStoredBirthDate(defaultBirthdayIso())!;
  const initial = stored || fallback;

  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(initial.jy);
  const [month, setMonth] = useState(initial.jm);
  const [day, setDay] = useState(initial.jd);

  useEffect(() => {
    const next = parseStoredBirthDate(value);
    if (next) {
      setYear(next.jy);
      setMonth(next.jm);
      setDay(Math.min(next.jd, jalaliDaysInMonth(next.jy, next.jm)));
    }
  }, [value]);

  const days = jalaliDaysInMonth(year, month);

  function apply(nextYear: number, nextMonth: number, nextDay: number) {
    const safeDay = Math.min(
      nextDay,
      jalaliDaysInMonth(nextYear, nextMonth)
    );

    const gregorian = jalaliToGregorian(
      nextYear,
      nextMonth,
      safeDay
    );

    setYear(nextYear);
    setMonth(nextMonth);
    setDay(safeDay);

    onChange(
      gregorianValue(
        gregorian.gy,
        gregorian.gm,
        gregorian.gd
      )
    );
  }

  const firstDayGregorian = jalaliToGregorian(year, month, 1);
  const weekday = new Date(
    firstDayGregorian.gy,
    firstDayGregorian.gm - 1,
    firstDayGregorian.gd
  ).getDay();

  // Persian week starts on Saturday.
  const leadingEmptyCells = (weekday + 1) % 7;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="input"
        disabled={disabled}
        onClick={() => !disabled && setOpen((current) => !current)}
        style={{
          width: "100%",
          textAlign: "right",
          background: "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {value
          ? `${toPersianDigits(year)}/${toPersianDigits(
              String(month).padStart(2, "0")
            )}/${toPersianDigits(String(day).padStart(2, "0"))}`
          : "انتخاب تاریخ تولد"}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 320,
            zIndex: 2000,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            boxShadow: "0 16px 40px rgba(15,23,42,.16)",
            padding: 14,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.9fr 1.35fr 0.9fr",
              gap: 8,
              marginBottom: 12,
              direction: "rtl",
            }}
          >
            <label
              style={{
                display: "grid",
                gap: 4,
                fontSize: 11,
                color: "#64748b",
              }}
            >
              روز
              <select
                className="input"
                value={day}
                onChange={(event) =>
                  apply(year, month, Number(event.target.value))
                }
                style={{ minHeight: 38, padding: "8px 9px" }}
                aria-label="روز"
              >
                {Array.from({ length: days }, (_, index) => index + 1).map(
                  (currentDay) => (
                    <option key={currentDay} value={currentDay}>
                      {toPersianDigits(currentDay)}
                    </option>
                  )
                )}
              </select>
            </label>

            <label
              style={{
                display: "grid",
                gap: 4,
                fontSize: 11,
                color: "#64748b",
              }}
            >
              ماه
              <select
                className="input"
                value={month}
                onChange={(event) =>
                  apply(year, Number(event.target.value), day)
                }
                style={{ minHeight: 38, padding: "8px 9px" }}
                aria-label="ماه"
              >
                {JALALI_MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label
              style={{
                display: "grid",
                gap: 4,
                fontSize: 11,
                color: "#64748b",
              }}
            >
              سال
              <select
                className="input"
                value={year}
                onChange={(event) =>
                  apply(Number(event.target.value), month, day)
                }
                style={{ minHeight: 38, padding: "8px 9px" }}
                aria-label="سال"
              >
                {Array.from({ length: 120 }, (_, index) => 1409 - index).map(
                  (jalaliYear) => (
                    <option key={jalaliYear} value={jalaliYear}>
                      {toPersianDigits(jalaliYear)}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 4,
              direction: "rtl",
            }}
          >
            {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((dayName) => (
              <div
                key={dayName}
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  color: "#64748b",
                  padding: "4px 0",
                  fontWeight: 700,
                }}
              >
                {dayName}
              </div>
            ))}

            {Array.from({ length: leadingEmptyCells }).map((_, index) => (
              <div key={`empty-${index}`} aria-hidden="true" />
            ))}

            {Array.from({ length: days }, (_, index) => index + 1).map(
              (currentDay) => (
                <button
                  key={currentDay}
                  type="button"
                  onClick={() => {
                    apply(year, month, currentDay);
                    setOpen(false);
                  }}
                  style={{
                    border:
                      currentDay === day
                        ? "1px solid #0f6b43"
                        : "1px solid transparent",
                    background:
                      currentDay === day ? "#0f6b43" : "transparent",
                    color:
                      currentDay === day ? "#fff" : "#334155",
                    borderRadius: 8,
                    padding: "7px 0",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {toPersianDigits(currentDay)}
                </button>
              )
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 12,
            }}
          >
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => {
                const now = new Date();
                const today = gregorianToJalali(
                  now.getFullYear(),
                  now.getMonth() + 1,
                  now.getDate()
                );

                apply(today.jy, today.jm, today.jd);
                setOpen(false);
              }}
            >
              امروز
            </button>

            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => setOpen(false)}
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesVisitorsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [tableFilters, setTableFilters] = useState<VisitorTableFilters>(
    EMPTY_VISITOR_TABLE_FILTERS
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VisitorForm>(emptyForm);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function ensureFreshSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("SESSION_EXPIRED");
    }

    const expiresAtMs = (session.expires_at || 0) * 1000;
    const shouldRefresh =
      !expiresAtMs || expiresAtMs - Date.now() < 60_000;

    if (shouldRefresh) {
      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data.session) {
        throw new Error("SESSION_EXPIRED");
      }
    }
  }

  function resetAvatarSelection() {
    setAvatarFile(null);
    setAvatarPreview("");
  }

  function handleAvatarFile(file: File | null) {
    setAvatarFile(file);

    if (!file) {
      setAvatarPreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("لطفاً فقط فایل تصویری انتخاب کنید.");
      setAvatarFile(null);
      setAvatarPreview("");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("حجم تصویر نباید بیشتر از ۵ مگابایت باشد.");
      setAvatarFile(null);
      setAvatarPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
  }

  async function loadData() {
    setLoading(true);

    try {
      await ensureFreshSession();
      const [profilesResult, visitorsResult, territoriesResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,full_name,phone,role,active")
            .eq("role", "visitor")
            .order("full_name", { ascending: true }),

          supabase
            .from("sales_visitors")
            .select(
              "id,profile_id,full_name,phone,avatar_url,employee_code,gender,birth_date,residential_address,residential_province,residential_city,active,tracking_enabled,created_at,updated_at"
            )
            .order("created_at", { ascending: false }),

          supabase
            .from("sales_visitor_territories")
            .select(
              "id,visitor_id,province,region,active,valid_from,valid_to"
            )
            .order("province", { ascending: true })
            .order("region", { ascending: true }),
        ]);

      if (visitorsResult.error) throw visitorsResult.error;
      if (territoriesResult.error) throw territoriesResult.error;

      const territoriesByVisitor = new Map<string, Territory[]>();

      (territoriesResult.data || []).forEach((row: any) => {
        const list = territoriesByVisitor.get(row.visitor_id) || [];
        list.push({
          id: row.id,
          province: row.province || "",
          region: row.region || "",
          active: row.active !== false,
          valid_from: row.valid_from || "",
          valid_to: row.valid_to || "",
        });
        territoriesByVisitor.set(row.visitor_id, list);
      });

      const mappedVisitors = (visitorsResult.data || []).map(
        (row: any): Visitor => ({
          id: String(row.id),
          profile_id: row.profile_id ? String(row.profile_id) : null,
          full_name: String(row.full_name || ""),
          phone: row.phone ? String(row.phone) : null,
          avatar_url: row.avatar_url ? String(row.avatar_url) : null,
          employee_code: row.employee_code
            ? String(row.employee_code)
            : null,
          gender:
            row.gender === "male" ||
            row.gender === "female" ||
            row.gender === "other"
              ? row.gender
              : null,
          birth_date: row.birth_date
            ? String(row.birth_date)
            : null,
          residential_address: row.residential_address
            ? String(row.residential_address)
            : null,
          residential_province: row.residential_province
            ? String(row.residential_province)
            : null,
          residential_city: row.residential_city
            ? String(row.residential_city)
            : null,
          active: row.active !== false,
          tracking_enabled: row.tracking_enabled === true,
          created_at: String(row.created_at || ""),
          updated_at: String(row.updated_at || ""),
          territories: territoriesByVisitor.get(row.id) || [],
        })
      );

      setProfiles(profilesResult.data || []);
      setVisitors(mappedVisitors);
    } catch (error: any) {
      console.error("SALES VISITORS LOAD ERROR:", error);
      alert(`خطا در دریافت اطلاعات ویزیتورها:\n${error?.message || "نامشخص"}`);
    } finally {
      setLoading(false);
    }
  }

  const availableProfiles = useMemo(() => {
    const usedProfileIds = new Set(
      visitors
        .map((visitor) => visitor.profile_id)
        .filter(Boolean) as string[]
    );

    return profiles.filter(
      (profile) =>
        profile.active !== false &&
        (!usedProfileIds.has(profile.id) || profile.id === form.profile_id)
    );
  }, [profiles, visitors, form.profile_id]);

  const filteredVisitors = useMemo(() => {
    const query = search.trim().toLowerCase();

    return visitors.filter((visitor) => {
      const searchableText = [
        visitor.full_name,
        visitor.phone || "",
        visitor.employee_code || "",
        filterableValue(visitor, "province"),
        filterableValue(visitor, "region"),
        filterableValue(visitor, "age"),
        filterableValue(visitor, "tracking"),
        filterableValue(visitor, "status"),
      ]
        .join(" ")
        .toLowerCase();

      if (query && !searchableText.includes(query)) {
        return false;
      }

      return (
        (tableFilters.full_name.length === 0 ||
          tableFilters.full_name.includes(
            filterableValue(visitor, "full_name")
          )) &&
        (tableFilters.phone.length === 0 ||
          tableFilters.phone.includes(filterableValue(visitor, "phone"))) &&
        (tableFilters.province.length === 0 ||
          tableFilters.province.some((selected) =>
            filterableValue(visitor, "province")
              .split("،")
              .map((value) => value.trim())
              .includes(selected)
          )) &&
        (tableFilters.region.length === 0 ||
          tableFilters.region.some((selected) =>
            filterableValue(visitor, "region")
              .split("،")
              .map((value) => value.trim())
              .includes(selected)
          )) &&
        (tableFilters.age.length === 0 ||
          tableFilters.age.includes(filterableValue(visitor, "age"))) &&
        (tableFilters.tracking.length === 0 ||
          tableFilters.tracking.includes(
            filterableValue(visitor, "tracking")
          )) &&
        (tableFilters.status.length === 0 ||
          tableFilters.status.includes(
            filterableValue(visitor, "status")
          ))
      );
    });
  }, [search, visitors, tableFilters]);

  const activeCount = visitors.filter((visitor) => visitor.active).length;
  const trackingCount = visitors.filter(
    (visitor) => visitor.active && visitor.tracking_enabled
  ).length;

  function openCreate() {
    setEditingId(null);
    resetAvatarSelection();
    setForm({
      ...emptyForm,
      territories: [emptyTerritory()],
    });
    setShowForm(true);
  }

  async function deleteVisitor(visitor: Visitor) {
    if (!confirm(`ویزیتور «${visitor.full_name || "بدون نام"}» حذف شود؟`)) {
      return;
    }

    setSaving(true);

    try {
      await ensureFreshSession();

      const territoryResult = await supabase
        .from("sales_visitor_territories")
        .delete()
        .eq("visitor_id", visitor.id);
      if (territoryResult.error) throw territoryResult.error;

      const planResult = await supabase
        .from("sales_visit_plans")
        .delete()
        .eq("visitor_id", visitor.id);
      if (planResult.error) throw planResult.error;

      const visitResult = await supabase
        .from("sales_visits")
        .delete()
        .eq("visitor_id", visitor.id);
      if (visitResult.error) throw visitResult.error;

      const locationResult = await supabase
        .from("sales_visitor_locations")
        .delete()
        .eq("visitor_id", visitor.id);
      if (locationResult.error) throw locationResult.error;

      const routeResult = await supabase
        .from("sales_routes")
        .delete()
        .eq("visitor_id", visitor.id);
      if (routeResult.error) throw routeResult.error;

      const customerResult = await supabase
        .from("customers")
        .update({ sales_visitor_id: null })
        .eq("sales_visitor_id", visitor.id);
      if (customerResult.error) throw customerResult.error;

      const visitorResult = await supabase
        .from("sales_visitors")
        .delete()
        .eq("id", visitor.id);
      if (visitorResult.error) throw visitorResult.error;

      setVisitors((current) =>
        current.filter((item) => item.id !== visitor.id)
      );

      if (editingId === visitor.id) {
        closeForm();
      }

      alert("ویزیتور با موفقیت حذف شد.");
    } catch (error: any) {
      console.error("DELETE VISITOR ERROR:", error);
      alert(`خطا در حذف ویزیتور:\n${error?.message || "نامشخص"}`);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(visitor: Visitor) {
    setEditingId(visitor.id);
    resetAvatarSelection();

    setForm({
      full_name: visitor.full_name || "",
      phone: visitor.phone || "",
      avatar_url: visitor.avatar_url || "",
      profile_id: visitor.profile_id || "",
      employee_code: visitor.employee_code || "",
      gender: visitor.gender || "",
      birth_date: visitor.birth_date || "",
      residential_address: visitor.residential_address || "",
      residential_province: visitor.residential_province || "",
      residential_city: visitor.residential_city || "",
      active: visitor.active,
      tracking_enabled: visitor.tracking_enabled,
      territories:
        visitor.territories.length > 0
          ? visitor.territories.map((item) => ({
              ...item,
              valid_from: item.valid_from || "",
              valid_to: item.valid_to || "",
            }))
          : [emptyTerritory()],
    });

    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingId(null);
    resetAvatarSelection();
    setForm(emptyForm);
  }

  function updateTerritory(
    index: number,
    field: keyof Territory,
    value: string | boolean
  ) {
    setForm((previous) => {
      const territories = [...previous.territories];
      territories[index] = {
        ...territories[index],
        [field]: value,
      };

      return {
        ...previous,
        territories,
      };
    });
  }

  function addTerritory() {
    setForm((previous) => ({
      ...previous,
      territories: [...previous.territories, emptyTerritory()],
    }));
  }

  function removeTerritory(index: number) {
    setForm((previous) => {
      const territories = previous.territories.filter(
        (_item, itemIndex) => itemIndex !== index
      );

      return {
        ...previous,
        territories: territories.length > 0 ? territories : [emptyTerritory()],
      };
    });
  }

  async function uploadAvatar(visitorId: string) {
    if (!avatarFile) {
      return form.avatar_url || null;
    }

    const extension =
      avatarFile.name.split(".").pop()?.toLowerCase() ||
      (avatarFile.type === "image/png" ? "png" : "jpg");

    const filePath = `${visitorId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("visitor-avatars")
      .upload(filePath, avatarFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: avatarFile.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("visitor-avatars")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function saveVisitor() {
    if (!form.full_name.trim()) {
      alert("لطفاً نام ویزیتور را وارد کنید.");
      return;
    }

    const cleanedTerritories = form.territories
      .map((item) => ({
        ...item,
        province: item.province.trim(),
        region: item.region.trim(),
      }))
      .filter((item) => item.province && item.region);

    const duplicateKeys = new Set<string>();
    for (const territory of cleanedTerritories) {
      const key = `${territory.province}::${territory.region}`.toLowerCase();
      if (duplicateKeys.has(key)) {
        alert(
          `محدوده «${territory.province} / ${territory.region}» بیش از یک‌بار ثبت شده است.`
        );
        return;
      }

      duplicateKeys.add(key);
    }

    setSaving(true);

    try {
      await ensureFreshSession();

      let visitorId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from("sales_visitors")
          .update({
            full_name: form.full_name.trim(),
            phone: form.phone.trim() || null,
            avatar_url: form.avatar_url || null,
            profile_id: form.profile_id || null,
            employee_code: form.employee_code.trim() || null,
            gender: form.gender || null,
            birth_date: form.birth_date || null,
            residential_address: form.residential_address.trim() || null,
            residential_province:
              form.residential_province.trim() || null,
            residential_city:
              form.residential_city.trim() || null,
            active: form.active,
            tracking_enabled: form.tracking_enabled,
          })
          .eq("id", editingId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("sales_visitors")
          .insert({
            full_name: form.full_name.trim(),
            phone: form.phone.trim() || null,
            avatar_url: form.avatar_url || null,
            profile_id: form.profile_id || null,
            employee_code: form.employee_code.trim() || null,
            gender: form.gender || null,
            birth_date: form.birth_date || null,
            residential_address: form.residential_address.trim() || null,
            residential_province:
              form.residential_province.trim() || null,
            residential_city:
              form.residential_city.trim() || null,
            active: form.active,
            tracking_enabled: form.tracking_enabled,
          })
          .select("id")
          .single();

        if (error) throw error;

        visitorId = data.id;
      }

      if (!visitorId) {
        throw new Error("شناسه ویزیتور ایجاد نشد.");
      }

      const uploadedAvatarUrl = await uploadAvatar(visitorId);

      if (uploadedAvatarUrl && uploadedAvatarUrl !== form.avatar_url) {
        const { error: avatarUpdateError } = await supabase
          .from("sales_visitors")
          .update({ avatar_url: uploadedAvatarUrl })
          .eq("id", visitorId);

        if (avatarUpdateError) {
          throw avatarUpdateError;
        }

        setForm((previous) => ({
          ...previous,
          avatar_url: uploadedAvatarUrl,
        }));
      }

      const { error: deleteTerritoriesError } = await supabase
        .from("sales_visitor_territories")
        .delete()
        .eq("visitor_id", visitorId);

      if (deleteTerritoriesError) throw deleteTerritoriesError;

      if (cleanedTerritories.length > 0) {
        const { error: territoryError } = await supabase
          .from("sales_visitor_territories")
          .insert(
            cleanedTerritories.map((territory) => ({
              visitor_id: visitorId,
              province: territory.province,
              region: territory.region,
              active: territory.active,
              valid_from: territory.valid_from || null,
              valid_to: territory.valid_to || null,
            }))
          );

        if (territoryError) throw territoryError;
      }

      // ویزیتور مستقل است. profile_id فقط در صورت نیاز برای اتصال آینده به ورود سیستم ذخیره می‌شود.
      // داده‌های فعلی customers دست‌نخورده باقی می‌مانند.

      alert(editingId ? "اطلاعات ویزیتور ذخیره شد." : "ویزیتور با موفقیت ایجاد شد.");

      closeForm();
      await loadData();
    } catch (error: any) {
      console.error("SALES VISITOR SAVE ERROR:", error);

      const message =
        error?.message === "SESSION_EXPIRED" ||
        error?.message === "JWT expired"
          ? "نشست ورود شما منقضی شده است. یک‌بار از حساب خارج شوید و دوباره وارد شوید، سپس دوباره ذخیره کنید."
          : `خطا در ذخیره ویزیتور:\n${error?.message || "نامشخص"}`;

      alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisitor(visitor: Visitor) {
    const nextActive = !visitor.active;

    if (
      !confirm(
        nextActive
          ? `ویزیتور «${visitor.full_name || "بدون نام"}» فعال شود؟`
          : `ویزیتور «${visitor.full_name || "بدون نام"}» غیرفعال شود؟`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("sales_visitors")
        .update({ active: nextActive })
        .eq("id", visitor.id);

      if (error) throw error;

      await loadData();
    } catch (error: any) {
      console.error("TOGGLE VISITOR ERROR:", error);
      alert(`خطا در تغییر وضعیت ویزیتور:\n${error?.message || "نامشخص"}`);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="مدیریت ویزیتورها"
        subtitle="تعریف، ویرایش، محدوده کاری و وضعیت ردیابی نیروهای فروش"
      />

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <article className="panel" style={{ padding: 18 }}>
          <div style={{ color: "#64748b", fontSize: 13 }}>کل ویزیتورها</div>
          <strong style={{ display: "block", fontSize: 28, marginTop: 6 }}>
            {visitors.length.toLocaleString("fa-IR")}
          </strong>
        </article>

        <article className="panel" style={{ padding: 18 }}>
          <div style={{ color: "#64748b", fontSize: 13 }}>ویزیتور فعال</div>
          <strong style={{ display: "block", fontSize: 28, marginTop: 6, color: "#047857" }}>
            {activeCount.toLocaleString("fa-IR")}
          </strong>
        </article>

        <article className="panel" style={{ padding: 18 }}>
          <div style={{ color: "#64748b", fontSize: 13 }}>ردیابی فعال</div>
          <strong style={{ display: "block", fontSize: 28, marginTop: 6, color: "#2563eb" }}>
            {trackingCount.toLocaleString("fa-IR")}
          </strong>
        </article>
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>فهرست ویزیتورها</h2>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
              هر ویزیتور می‌تواند هم‌زمان در چند استان و منطقه فعالیت داشته باشد.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", minWidth: 260 }}>
              <Search
                size={17}
                style={{
                  position: "absolute",
                  right: 11,
                  top: 11,
                  color: "#94a3b8",
                }}
              />
              <input
                className="input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جستجوی نام، تلفن یا محدوده..."
                style={{ paddingRight: 38 }}
              />
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => {
            setSearch("");
            setTableFilters(EMPTY_VISITOR_TABLE_FILTERS);
          }}
          style={{ whiteSpace: "nowrap" }}
        >
          حذف فیلترها
        </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void loadData()}
              disabled={loading || saving}
            >
              <RefreshCw size={16} />
              بروزرسانی
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
              disabled={saving}
            >
              <Plus size={16} />
              ویزیتور جدید
            </button>
          </div>
        </div>
      </section>

      <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
            در حال دریافت ویزیتورها...
          </div>
        ) : filteredVisitors.length === 0 ? (
          <div
            style={{
              padding: 50,
              textAlign: "center",
              color: "#64748b",
            }}
          >
            {visitors.length === 0
              ? "هنوز ویزیتوری تعریف نشده است."
              : "موردی با جستجوی شما پیدا نشد."}
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                          <span>ویزیتور</span>
                          <VisitorColumnFilter
                            title="ویزیتور"
                            values={visitors.map((item) => item.full_name)}
                            selected={tableFilters.full_name}
                            onChange={(next) =>
                              setTableFilters((current) => ({
                                ...current,
                                full_name: next,
                              }))
                            }
                          />
                        </div>
                      </th>

                      <th>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                          <span>تلفن</span>
                          <VisitorColumnFilter
                            title="تلفن"
                            values={visitors.map((item) => item.phone || "")}
                            selected={tableFilters.phone}
                            onChange={(next) =>
                              setTableFilters((current) => ({
                                ...current,
                                phone: next,
                              }))
                            }
                          />
                        </div>
                      </th>

                      <th>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                          <span>استان ویزیت</span>
                          <VisitorColumnFilter
                            title="استان ویزیت"
                            values={Array.from(
                              new Set(
                                visitors.flatMap((visitor) =>
                                  visitor.territories
                                    .filter((item) => item.active)
                                    .map((item) => item.province)
                                )
                              )
                            )}
                            selected={tableFilters.province}
                            onChange={(next) =>
                              setTableFilters((current) => ({
                                ...current,
                                province: next,
                              }))
                            }
                          />
                        </div>
                      </th>

                      <th>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                          <span>منطقه ویزیت</span>
                          <VisitorColumnFilter
                            title="منطقه ویزیت"
                            values={Array.from(
                              new Set(
                                visitors.flatMap((visitor) =>
                                  visitor.territories
                                    .filter((item) => item.active)
                                    .map((item) => item.region)
                                )
                              )
                            )}
                            selected={tableFilters.region}
                            onChange={(next) =>
                              setTableFilters((current) => ({
                                ...current,
                                region: next,
                              }))
                            }
                          />
                        </div>
                      </th>

                      <th>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                          <span>سن</span>
                          <VisitorColumnFilter
                            title="سن"
                            values={visitors.map((item) => {
                              const age = calculateAge(item.birth_date);
                              return age === null ? "" : String(age);
                            })}
                            selected={tableFilters.age}
                            onChange={(next) =>
                              setTableFilters((current) => ({
                                ...current,
                                age: next,
                              }))
                            }
                          />
                        </div>
                      </th>

                      <th>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                          <span>ردیابی</span>
                          <VisitorColumnFilter
                            title="ردیابی"
                            values={visitors.map((item) =>
                              item.tracking_enabled ? "فعال" : "خاموش"
                            )}
                            selected={tableFilters.tracking}
                            onChange={(next) =>
                              setTableFilters((current) => ({
                                ...current,
                                tracking: next,
                              }))
                            }
                          />
                        </div>
                      </th>

                      <th>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                          <span>وضعیت</span>
                          <VisitorColumnFilter
                            title="وضعیت"
                            values={visitors.map((item) =>
                              item.active ? "فعال" : "غیرفعال"
                            )}
                            selected={tableFilters.status}
                            onChange={(next) =>
                              setTableFilters((current) => ({
                                ...current,
                                status: next,
                              }))
                            }
                          />
                        </div>
                      </th>

                      <th>عملیات</th>
                    </tr>
                  </thead>

              <tbody>
                {filteredVisitors.map((visitor) => {
                  const age = calculateAge(visitor.birth_date);

                  return (
                    <tr key={visitor.id}>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                          }}
                        >
                          {visitor.avatar_url ? (
                            <img
                              src={visitor.avatar_url}
                              alt=""
                              style={{
                                width: 38,
                                height: 38,
                                objectFit: "cover",
                                borderRadius: "50%",
                                border: "1px solid #dbe3ea",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: "50%",
                                display: "grid",
                                placeItems: "center",
                                background: "#e9f4ef",
                                color: "#0f6b43",
                                fontWeight: 900,
                              }}
                            >
                              {(visitor.full_name || "و")[0]}
                            </div>
                          )}

                          <strong>{visitor.full_name || "بدون نام"}</strong>
                        </div>
                      </td>

                      <td>{visitor.phone || "-"}</td>

                      <td>
                        {visitor.territories.filter((item) => item.active).length === 0
                          ? "-"
                          : Array.from(
                              new Set(
                                visitor.territories
                                  .filter((item) => item.active)
                                  .map((item) => item.province)
                                  .filter(Boolean)
                              )
                            ).join("، ")}
                      </td>

                      <td>
                        {visitor.territories.filter((item) => item.active).length === 0
                          ? "-"
                          : visitor.territories
                              .filter((item) => item.active)
                              .map((item) => item.region)
                              .filter(Boolean)
                              .join("، ")}
                      </td>

                      <td>
                        {age === null
                          ? "-"
                          : `${age.toLocaleString("fa-IR")} سال`}
                      </td>

                      <td>
                        {visitor.tracking_enabled ? "فعال" : "خاموش"}
                      </td>

                      <td>
                        <span
                          style={{
                            color: visitor.tracking_enabled ? "#047857" : "#64748b",
                            fontWeight: 700,
                          }}
                        >
                          {visitor.tracking_enabled ? "فعال" : "خاموش"}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "5px 9px",
                            borderRadius: 999,
                            background: visitor.active ? "#dcfce7" : "#f1f5f9",
                            color: visitor.active ? "#166534" : "#475569",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {visitor.active ? "فعال" : "غیرفعال"}
                        </span>
                      </td>

                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => openEdit(visitor)}
                          >
                            <Edit3 size={14} />
                            ویرایش
                          </button>

                          <button
                            type="button"
                            className={
                              visitor.active
                                ? "btn btn-danger btn-small"
                                : "btn btn-primary btn-small"
                            }
                            onClick={() => void toggleVisitor(visitor)}
                          >
                            {visitor.active ? (
                              <UserX size={14} />
                            ) : (
                              <UserCheck size={14} />
                            )}
                            {visitor.active ? "غیرفعال" : "فعال"}
                          </button>

                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() => deleteVisitor(visitor)}
                            disabled={saving}
                            style={{
                              background: "#fff",
                              color: "#b91c1c",
                              border: "1px solid #fecaca",
                            }}
                          >
                            <X size={14} />
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15,23,42,.45)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "18px 18px 28px",
            overflowY: "auto",
            boxSizing: "border-box",
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(980px, 100%)",
              maxHeight: "calc(100vh - 36px)",
              overflowY: "auto",
              padding: 0,
              marginTop: 18,
              marginBottom: 18,
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "18px 20px",
                borderBottom: "1px solid #e2e8f0",
                position: "sticky",
                top: 0,
                background: "#fff",
                zIndex: 2,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>
                  {editingId ? "ویرایش ویزیتور" : "تعریف ویزیتور"}
                </h2>
                <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12 }}>
                  اطلاعات پرسنلی و محدوده‌های کاری را ثبت کنید.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={closeForm}
                disabled={saving}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  marginBottom: 18,
                  padding: 14,
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    width: 92,
                    height: 92,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "#e9f4ef",
                    border: "1px solid #cfe2d9",
                    display: "grid",
                    placeItems: "center",
                    color: "#0f6b43",
                    fontSize: 30,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  {avatarPreview || form.avatar_url ? (
                    <img
                      src={avatarPreview || form.avatar_url}
                      alt="تصویر ویزیتور"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    (form.full_name || "و")[0]
                  )}
                </div>

                <div>
                  <div style={{ fontWeight: 800, marginBottom: 5 }}>
                    تصویر ویزیتور
                  </div>
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: 12,
                      marginBottom: 9,
                    }}
                  >
                    تصویر پروفایل ویزیتور را انتخاب کنید. حداکثر ۵ مگابایت.
                  </div>
                  <label className="btn btn-secondary btn-small" style={{ cursor: "pointer" }}>
                    انتخاب تصویر
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: "none" }}
                      disabled={saving}
                      onChange={(event) =>
                        handleAvatarFile(event.target.files?.[0] || null)
                      }
                    />
                  </label>

                  {(avatarFile || form.avatar_url) && (
                    <button
                      type="button"
                      className="btn btn-small"
                      style={{
                        marginRight: 8,
                        background: "#fff",
                        color: "#b91c1c",
                        border: "1px solid #fecaca",
                      }}
                      disabled={saving}
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview("");
                        setForm((previous) => ({
                          ...previous,
                          avatar_url: "",
                        }));
                      }}
                    >
                      حذف تصویر
                    </button>
                  )}
                </div>
              </div>

              <div
                className="form-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                }}
              >
                <div className="form-field">
                  <label>نام ویزیتور</label>
                  <input
                    className="input"
                    value={form.full_name}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        full_name: event.target.value,
                      }))
                    }
                    placeholder="نام و نام خانوادگی"
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label>شماره تماس</label>
                  <input
                    className="input"
                    value={form.phone}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="مثلاً 0912..."
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label>کد پرسنلی</label>
                  <input
                    className="input"
                    value={form.employee_code}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        employee_code: event.target.value,
                      }))
                    }
                    placeholder="مثلاً V-001"
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label>جنسیت</label>
                  <select
                    className="input"
                    value={form.gender}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        gender: event.target.value as VisitorForm["gender"],
                      }))
                    }
                    disabled={saving}
                  >
                    <option value="">انتخاب کنید</option>
                    <option value="male">مرد</option>
                    <option value="female">زن</option>
                    <option value="other">سایر</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>تاریخ تولد</label>
                  <PersianDatePicker
                    value={form.birth_date}
                    disabled={saving}
                    onChange={(value) =>
                      setForm((previous) => ({
                        ...previous,
                        birth_date: value,
                      }))
                    }
                  />
                  {form.birth_date && (
                    <small style={{ color: "#64748b", marginTop: 5, display: "block" }}>
                      سن: محاسبه پس از ثبت تاریخ تولد
                    </small>
                  )}
                </div>

                <div className="form-field">
                  <label>حساب کاربری (اختیاری)</label>
                  <select
                    className="input"
                    disabled={saving}
                    value={form.profile_id}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        profile_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">فعلاً بدون حساب کاربری</option>

                    {availableProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profileLabel(profile)}
                      </option>
                    ))}
                  </select>

                  <small
                    style={{
                      marginTop: 5,
                      color: "#64748b",
                      display: "block",
                    }}
                  >
                    اتصال به حساب کاربری اختیاری است و بعداً می‌توانیم برای ورود ویزیتور استفاده کنیم.
                  </small>
                </div>

                <div className="form-field">
                  <label>استان سکونت</label>
                  <select
                    className="input"
                    value={form.residential_province}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        residential_province: event.target.value,
                        residential_city: "",
                      }))
                    }
                    disabled={saving}
                  >
                    <option value="">انتخاب استان</option>
                    {Object.keys(IRAN_PROVINCES).map((province) => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>شهر سکونت</label>
                  <select
                    className="input"
                    value={form.residential_city}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        residential_city: event.target.value,
                      }))
                    }
                    disabled={saving || !form.residential_province}
                  >
                    <option value="">
                      {form.residential_province
                        ? "انتخاب شهر"
                        : "ابتدا استان را انتخاب کنید"}
                    </option>

                    {(IRAN_PROVINCES[form.residential_province] || []).map(
                      (city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-field full" style={{ gridColumn: "1 / -1" }}>
                  <label>آدرس سکونت</label>
                  <textarea
                    className="textarea"
                    rows={2}
                    value={form.residential_address}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        residential_address: event.target.value,
                      }))
                    }
                    placeholder="آدرس محل سکونت"
                    disabled={saving}
                  />
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 12,
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        active: event.target.checked,
                      }))
                    }
                    disabled={saving}
                  />
                  <span>ویزیتور فعال باشد</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 12,
                    border: "1px solid #bfdbfe",
                    background: "#eff6ff",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.tracking_enabled}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        tracking_enabled: event.target.checked,
                      }))
                    }
                    disabled={saving || !form.active}
                  />
                  <span>ردیابی GPS فعال باشد</span>
                </label>
              </div>

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 18,
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>محدوده‌های کاری</h3>
                    <p
                      style={{
                        margin: "5px 0 0",
                        color: "#64748b",
                        fontSize: 12,
                      }}
                    >
                      استان از فهرست ایران انتخاب می‌شود و منطقه ویزیت را خودتان وارد می‌کنید.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={addTerritory}
                    disabled={saving}
                  >
                    <Plus size={14} />
                    افزودن محدوده
                  </button>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {form.territories.map((territory, index) => (
                    <div
                      key={`${territory.id || "new"}-${index}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(160px, 1fr) minmax(160px, 1fr) 120px 42px",
                        gap: 8,
                        alignItems: "end",
                        padding: 10,
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        background: "#f8fafc",
                      }}
                    >
                      <div className="form-field">
                        <label>استان ویزیت</label>
                        <select
                          className="input"
                          value={territory.province}
                          onChange={(event) =>
                            updateTerritory(
                              index,
                              "province",
                              event.target.value
                            )
                          }
                          disabled={saving}
                        >
                          <option value="">انتخاب استان</option>
                          {Object.keys(IRAN_PROVINCES).map((province) => (
                            <option key={province} value={province}>
                              {province}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-field">
                        <label>منطقه ویزیت</label>
                        <input
                          className="input"
                          value={territory.region}
                          onChange={(event) =>
                            updateTerritory(
                              index,
                              "region",
                              event.target.value
                            )
                          }
                          placeholder="مثلاً غرب تهران"
                          disabled={saving}
                        />
                      </div>

                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          minHeight: 42,
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          background: "#fff",
                          fontSize: 12,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={territory.active}
                          onChange={(event) =>
                            updateTerritory(
                              index,
                              "active",
                              event.target.checked
                            )
                          }
                          disabled={saving}
                        />
                        فعال
                      </label>

                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={() => removeTerritory(index)}
                        disabled={saving}
                        title="حذف محدوده"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 22,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeForm}
                  disabled={saving}
                >
                  انصراف
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void saveVisitor()}
                  disabled={saving || !form.full_name.trim()}
                >
                  <Save size={16} />
                  {saving
                    ? "در حال ذخیره..."
                    : editingId
                    ? "ذخیره تغییرات"
                    : "ثبت ویزیتور"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}