import { useMemo, useState, type ReactNode, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, X, CalendarDays, Layers3, MapPinned, UserRound, SlidersHorizontal } from "lucide-react";

type HeaderItem = {
  id: string;
  title: string;
  items: string[];
};

const HEADERS: HeaderItem[] = [
  {
    id: "sales_decline",
    title: "افت فروش",
    items: [
      "نرخ حفظ مشتری",
      "نرخ ریزش مشتری",
      "درصد مشتریان فعال",
      "پوشش مشتریان هدف",
      "نرخ تکرار خرید",
      "درصد تأمین کامل سفارش",
      "فروش از دست‌رفته",
      "روند فروش مشتریان کلیدی",
      "میزان بدهی و تأخیر در تسویه مشتریان",
      "مطالبات سررسیدگذشته",
    ],
  },
  {
    id: "sales_growth",
    title: "رشد فروش",
    items: [
      "فروش به ازای هر مشتری",
      "سهم از خرید مشتری",
      "تعداد اقلام در هر سفارش",
      "نرخ تبدیل ویزیت به سفارش",
      "فروش محصولات جدید",
      "فروش به مشتریان جدید",
      "رشد فروش مشتریان موجود",
      "فروش از دست‌رفته قابل بازیابی",
      "بهره‌وری نیروی فروش",
    ],
  },
  {
    id: "sales_profit",
    title: "سود فروش",
    items: [
      "حاشیه سود هر مشتری",
      "حاشیه سود هر محصول",
      "سود هر ویزیتور",
    ],
  },
  {
    id: "liquidity",
    title: "نقدینگی",
    items: [
      "درصد وصول مطالبات",
      "مطالبات سررسیدگذشته",
      "میانگین زمان وصول پول",
      "مانده حساب مشتریان",
      "نسبت فروش نقدی به اعتباری",
    ],
  },
];

const PROVINCES = [
  "آذربایجان شرقی",
  "آذربایجان غربی",
  "اردبیل",
  "اصفهان",
  "البرز",
  "ایلام",
  "بوشهر",
  "تهران",
  "چهارمحال و بختیاری",
  "خراسان جنوبی",
  "خراسان رضوی",
  "خراسان شمالی",
  "خوزستان",
  "زنجان",
  "سمنان",
  "سیستان و بلوچستان",
  "فارس",
  "قزوین",
  "قم",
  "کردستان",
  "کرمان",
  "کرمانشاه",
  "کهگیلویه و بویراحمد",
  "گلستان",
  "گیلان",
  "لرستان",
  "مازندران",
  "مرکزی",
  "هرمزگان",
  "همدان",
  "یزد",
];

// فهرست پیش‌فرض شهرها برای اینکه انتخاب شهر از همان ابتدا قابل استفاده باشد.
// بعداً در صورت اتصال فیلد شهر به جدول مشتریان می‌توان این منبع را با داده واقعی جایگزین کرد.
const CITIES_BY_PROVINCE: Record<string, string[]> = {
  "آذربایجان شرقی": ["تبریز", "مراغه", "مرند", "میانه", "اهر", "شبستر"],
  "آذربایجان غربی": ["ارومیه", "خوی", "مهاباد", "میاندوآب", "بوکان", "سلماس"],
  "اردبیل": ["اردبیل", "مشگین‌شهر", "پارس‌آباد", "خلخال", "نمین"],
  "اصفهان": ["اصفهان", "کاشان", "خمینی‌شهر", "نجف‌آباد", "شاهین‌شهر", "فلاورجان"],
  "البرز": ["کرج", "فردیس", "نظرآباد", "هشتگرد", "محمدشهر"],
  "ایلام": ["ایلام", "دهلران", "آبدانان", "دره‌شهر", "مهران"],
  "بوشهر": ["بوشهر", "برازجان", "گناوه", "کنگان", "جم", "عسلویه"],
  "تهران": ["تهران", "ری", "شهریار", "قدس", "ملارد", "پردیس", "دماوند", "ورامین", "اسلامشهر"],
  "چهارمحال و بختیاری": ["شهرکرد", "بروجن", "فارسان", "لردگان", "سامان"],
  "خراسان جنوبی": ["بیرجند", "قائن", "طبس", "فردوس", "نهبندان"],
  "خراسان رضوی": ["مشهد", "نیشابور", "سبزوار", "تربت حیدریه", "قوچان", "کاشمر", "گناباد"],
  "خراسان شمالی": ["بجنورد", "شیروان", "اسفراین", "جاجرم", "فاروج"],
  "خوزستان": ["اهواز", "دزفول", "آبادان", "خرمشهر", "اندیمشک", "ماهشهر", "بهبهان"],
  "زنجان": ["زنجان", "ابهر", "خرمدره", "قیدار", "طارم"],
  "سمنان": ["سمنان", "شاهرود", "دامغان", "گرمسار", "مهدی‌شهر"],
  "سیستان و بلوچستان": ["زاهدان", "چابهار", "زابل", "ایرانشهر", "خاش"],
  "فارس": ["شیراز", "مرودشت", "جهرم", "فسا", "لار", "کازرون", "آباده"],
  "قزوین": ["قزوین", "تاکستان", "آبیک", "بوئین‌زهرا", "الوند"],
  "قم": ["قم"],
  "کردستان": ["سنندج", "سقز", "بانه", "مریوان", "قروه"],
  "کرمان": ["کرمان", "رفسنجان", "سیرجان", "جیرفت", "بم", "زرند"],
  "کرمانشاه": ["کرمانشاه", "اسلام‌آباد غرب", "کنگاور", "هرسین", "پاوه", "سنقر"],
  "کهگیلویه و بویراحمد": ["یاسوج", "گچساران", "دهدشت", "سی‌سخت"],
  "گلستان": ["گرگان", "گنبد کاووس", "علی‌آباد کتول", "آق‌قلا", "بندر ترکمن"],
  "گیلان": ["رشت", "انزلی", "لاهیجان", "رودسر", "آستانه اشرفیه", "تالش"],
  "لرستان": ["خرم‌آباد", "بروجرد", "دورود", "الیگودرز", "کوهدشت"],
  "مازندران": ["ساری", "بابل", "آمل", "قائم‌شهر", "نوشهر", "چالوس", "تنکابن"],
  "مرکزی": ["اراک", "ساوه", "خمین", "محلات", "دلیجان"],
  "هرمزگان": ["بندرعباس", "قشم", "بندر لنگه", "میناب", "رودان", "کیش"],
  "همدان": ["همدان", "ملایر", "نهاوند", "تویسرکان", "اسدآباد"],
  "یزد": ["یزد", "میبد", "اردکان", "مهریز", "بافق"],
};

const MONTH_NAMES = [
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

const WEEK_DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function toEnglishDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function div(a: number, b: number) {
  return Math.floor(a / b);
}

function mod(a: number, b: number) {
  return a - Math.floor(a / b) * b;
}

function jalaliToGregorian(jy: number, jm: number, jd: number) {
  let gy;
  let days;

  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }

  if (jy < 0) jy += 0;

  const jy2 = jy <= 0 ? jy + 1 : jy;
  days = 365 * jy2 + div(jy2, 33) * 8 + div(mod(jy2, 33) + 3, 4);
  days += jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186;
  days += jd - 1;
  days += 78;

  gy += 400 * div(days, 146097);
  days = mod(days, 146097);

  if (days >= 36525) {
    days--;
    gy += 100 * div(days, 36524);
    days = mod(days, 36524);
    if (days >= 365) days++;
  }

  gy += 4 * div(days, 1461);
  days = mod(days, 1461);

  if (days >= 366) {
    gy += div(days - 1, 365);
    days = mod(days - 1, 365);
  }

  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  let gm = 1;
  while (gm <= 12 && gd > monthDays[gm - 1]) {
    gd -= monthDays[gm - 1];
    gm++;
  }

  return { gy, gm, gd };
}

function gregorianToJalali(gy: number, gm: number, gd: number) {
  let jy;
  let days;
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

  if (gy > 1600) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }

  const gy2 = gm > 2 ? gy + 1 : gy;
  days = 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) - 80 + gd + gdm[gm - 1];
  jy += 33 * div(days, 12053);
  days = mod(days, 12053);
  jy += 4 * div(days, 1461);
  days = mod(days, 1461);

  if (days > 365) {
    jy += div(days - 1, 365);
    days = mod(days - 1, 365);
  }

  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? mod(days, 31) : mod(days - 186, 30));

  return { jy, jm, jd };
}

function isJalaliLeapYear(year: number) {
  const a = jalaliToGregorian(year, 1, 1);
  const b = jalaliToGregorian(year + 1, 1, 1);
  const dateA = Date.UTC(a.gy, a.gm - 1, a.gd);
  const dateB = Date.UTC(b.gy, b.gm - 1, b.gd);
  return Math.round((dateB - dateA) / 86400000) === 366;
}

function monthDays(year: number, month: number) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isJalaliLeapYear(year) ? 30 : 29;
}

function getTodayJalali() {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function makeJalaliDateString(year: number, month: number, day: number) {
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

function parseJalaliDate(value: string) {
  const parts = toEnglishDigits(value).split("/").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  const [year, month, day] = parts;
  if (year < 1300 || year > 1500 || month < 1 || month > 12 || day < 1 || day > monthDays(year, month)) return null;
  return { year, month, day };
}

export default function CustomerMapToolbar({
  visitors = [],
}: {
  visitors?: { id: string; full_name: string }[];
}) {
  const today = getTodayJalali();
  const [open, setOpen] = useState(true);
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [selectedSubLayer, setSelectedSubLayer] = useState("");
  const [baseFromDate, setBaseFromDate] = useState("");
  const [baseToDate, setBaseToDate] = useState("");
  const [compareFromDate, setCompareFromDate] = useState("");
  const [compareToDate, setCompareToDate] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState("");
  const [calendarTarget, setCalendarTarget] = useState<
    "baseFrom" | "baseTo" | "compareFrom" | "compareTo" | null
  >(null);
  const [calendarYear, setCalendarYear] = useState(today.jy);
  const [calendarMonth, setCalendarMonth] = useState(today.jm);

  const selectedLayer = useMemo(
    () => HEADERS.find((header) => header.id === selectedLayerId) ?? null,
    [selectedLayerId],
  );

  const cityOptions = selectedProvince ? CITIES_BY_PROVINCE[selectedProvince] ?? [] : [];

  function selectLayer(layerId: string) {
    setSelectedLayerId(layerId);
    setSelectedSubLayer("");
  }

  function selectProvince(province: string) {
    setSelectedProvince(province);
    setSelectedCity("");
  }

  function getTargetDate(target: NonNullable<typeof calendarTarget>) {
    switch (target) {
      case "baseFrom":
        return baseFromDate;
      case "baseTo":
        return baseToDate;
      case "compareFrom":
        return compareFromDate;
      case "compareTo":
        return compareToDate;
    }
  }

  function openCalendar(target: NonNullable<typeof calendarTarget>) {
    const current = parseJalaliDate(getTargetDate(target));
    if (current) {
      setCalendarYear(current.year);
      setCalendarMonth(current.month);
    } else {
      setCalendarYear(today.jy);
      setCalendarMonth(today.jm);
    }
    setCalendarTarget(target);
  }

  function moveMonth(offset: number) {
    let year = calendarYear;
    let month = calendarMonth + offset;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    if (month > 12) {
      month = 1;
      year += 1;
    }
    setCalendarYear(year);
    setCalendarMonth(month);
  }

  function chooseDate(day: number) {
    if (!calendarTarget) return;
    const value = makeJalaliDateString(calendarYear, calendarMonth, day);

    switch (calendarTarget) {
      case "baseFrom":
        setBaseFromDate(value);
        break;
      case "baseTo":
        setBaseToDate(value);
        break;
      case "compareFrom":
        setCompareFromDate(value);
        break;
      case "compareTo":
        setCompareToDate(value);
        break;
    }

    setCalendarTarget(null);
  }

  function clearFilters() {
    setSelectedLayerId("");
    setSelectedSubLayer("");
    setBaseFromDate("");
    setBaseToDate("");
    setCompareFromDate("");
    setCompareToDate("");
    setSelectedProvince("");
    setSelectedCity("");
    setSelectedVisitor("");
    setCalendarTarget(null);
  }

  const firstWeekday = (() => {
    const g = jalaliToGregorian(calendarYear, calendarMonth, 1);
    return (new Date(g.gy, g.gm - 1, g.gd).getDay() + 1) % 7;
  })();
  const daysInMonth = monthDays(calendarYear, calendarMonth);

  return (
    <>
      <div
        dir="rtl"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: open ? "min(245px, 92%)" : 34,
          zIndex: 12000,
          transition: "width 180ms ease",
          pointerEvents: "none",
          fontFamily: "inherit",
        }}
      >
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="باز کردن فیلترها"
            style={{
              pointerEvents: "auto",
              position: "absolute",
              top: 14,
              right: 0,
              width: 36,
              height: 72,
              border: "1px solid #cbd5e1",
              borderRadius: "12px 0 0 12px",
              background: "rgba(255,255,255,0.96)",
              color: "#0f6b43",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 5px 16px rgba(15,23,42,0.16)",
              backdropFilter: "blur(6px)",
            }}
          >
            <SlidersHorizontal size={17} />
          </button>
        ) : (
          <div
            style={{
              pointerEvents: "auto",
              position: "absolute",
              top: 0,
              right: 0,
              width: "100%",
              maxWidth: 245,
              maxHeight: "100%",
              overflowY: "auto",
              paddingLeft: 1,
              paddingRight: 1,
              paddingBottom: 1,
            }}
          >
            <div
              style={{
                position: "relative",
                background: "rgba(255,255,255,0.97)",
                border: "1px solid #d7e3dc",
                borderRadius: 14,
                boxShadow: "0 8px 24px rgba(15,23,42,0.18)",
                backdropFilter: "blur(9px)",
              }}
            >
              <button
                type="button"
                onClick={clearFilters}
                title="حذف همه فیلترها"
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  width: 19,
                  height: 19,
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  background: "#fff1f2",
                  color: "#dc2626",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 2,
                }}
              >
                <X size={11} strokeWidth={2.8} />
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                title="بستن فیلترها"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 19,
                  height: 19,
                  border: "1px solid #dbe4df",
                  borderRadius: 6,
                  background: "#f8faf9",
                  color: "#475569",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 2,
                }}
              >
                <ChevronRight size={12} />
              </button>

              <div style={{ padding: "30px 10px 10px" }}>
                <FilterBox title="شاخص اصلی" icon={<Layers3 size={13} />}>
                  <SelectField
                    value={selectedLayerId}
                    onChange={selectLayer}
                    options={HEADERS.map((header) => ({ value: header.id, label: header.title }))}
                    placeholder="انتخاب لایه"
                  />
                </FilterBox>

                <FilterBox title="شاخص فرعی">
                  <SelectField
                    value={selectedSubLayer}
                    onChange={setSelectedSubLayer}
                    options={(selectedLayer?.items ?? []).map((item) => ({ value: item, label: item }))}
                    placeholder={selectedLayer ? "انتخاب زیر لایه" : "ابتدا لایه را انتخاب کنید"}
                    disabled={!selectedLayer}
                  />
                </FilterBox>

                <FilterBox title="دوره‌های مقایسه" icon={<CalendarDays size={13} />}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        border: "1px solid #dbe5df",
                        borderRadius: 8,
                        background: "#f8faf9",
                        padding: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 900,
                          color: "#0f6b43",
                          textAlign: "center",
                          marginBottom: 5,
                        }}
                      >
                        تاریخ مبنا
                      </div>
                      <div style={{ display: "grid", gap: 5 }}>
                        <DateButton
                          label="از"
                          value={baseFromDate}
                          onClick={() => openCalendar("baseFrom")}
                          active={calendarTarget === "baseFrom"}
                        />
                        <DateButton
                          label="تا"
                          value={baseToDate}
                          onClick={() => openCalendar("baseTo")}
                          active={calendarTarget === "baseTo"}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        border: "1px solid #dbe5df",
                        borderRadius: 8,
                        background: "#f8faf9",
                        padding: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 900,
                          color: "#0f6b43",
                          textAlign: "center",
                          marginBottom: 5,
                        }}
                      >
                        تاریخ مقایسه
                      </div>
                      <div style={{ display: "grid", gap: 5 }}>
                        <DateButton
                          label="از"
                          value={compareFromDate}
                          onClick={() => openCalendar("compareFrom")}
                          active={calendarTarget === "compareFrom"}
                        />
                        <DateButton
                          label="تا"
                          value={compareToDate}
                          onClick={() => openCalendar("compareTo")}
                          active={calendarTarget === "compareTo"}
                        />
                      </div>
                    </div>
                  </div>

                  {calendarTarget && (
                    <PersianCalendar
                      year={calendarYear}
                      month={calendarMonth}
                      selected={getTargetDate(calendarTarget)}
                      firstWeekday={firstWeekday}
                      daysInMonth={daysInMonth}
                      onPrevMonth={() => moveMonth(-1)}
                      onNextMonth={() => moveMonth(1)}
                      onChooseDay={chooseDate}
                    />
                  )}
                </FilterBox>

                <FilterBox title="استان" icon={<MapPinned size={13} />}>
                  <SelectField
                    value={selectedProvince}
                    onChange={selectProvince}
                    options={PROVINCES.map((province) => ({ value: province, label: province }))}
                    placeholder="انتخاب استان"
                  />
                </FilterBox>

                <FilterBox title="شهر">
                  <SelectField
                    value={selectedCity}
                    onChange={setSelectedCity}
                    options={cityOptions.map((city) => ({ value: city, label: city }))}
                    placeholder={selectedProvince ? "انتخاب شهر" : "ابتدا استان را انتخاب کنید"}
                    disabled={!selectedProvince}
                  />
                </FilterBox>

                <FilterBox title="ویزیتور" icon={<UserRound size={13} />}>
                  <SelectField
                    value={selectedVisitor}
                    onChange={setSelectedVisitor}
                    options={visitors.map((visitor) => ({
                      value: visitor.id,
                      label: visitor.full_name,
                    }))}
                    placeholder="انتخاب ویزیتور"
                  />
                </FilterBox>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function FilterBox({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #dbe5df",
        borderRadius: 11,
        background: "#fbfdfc",
        padding: 7,
        marginBottom: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginBottom: 6,
          color: "#334155",
          fontSize: 11,
          fontWeight: 900,
        }}
      >
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function SelectField({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: "100%",
        height: 34,
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        padding: "0 9px",
        background: disabled ? "#f1f5f9" : "#ffffff",
        color: disabled ? "#94a3b8" : "#111827",
        fontSize: 11.5,
        fontWeight: 700,
        fontFamily: "inherit",
        outline: "none",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function DateButton({
  label,
  value,
  onClick,
  active,
}: {
  label: string;
  value: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minWidth: 0,
        width: "100%",
        border: `1px solid ${active ? "#0f6b43" : "#cbd5e1"}`,
        borderRadius: 8,
        background: "#ffffff",
        padding: "7px 8px",
        cursor: "pointer",
        textAlign: "center",
        fontFamily: "inherit",
      }}
    >
      <div style={{ color: "#475569", fontSize: 9.5, fontWeight: 800, marginBottom: 3 }}>{label}</div>
      <div style={{ color: value ? "#111827" : "#94a3b8", fontSize: 11.5, fontWeight: 800 }}>
        {value ? toPersianDigits(value) : "انتخاب تاریخ"}
      </div>
    </button>
  );
}

function PersianCalendar({
  year,
  month,
  selected,
  firstWeekday,
  daysInMonth,
  onPrevMonth,
  onNextMonth,
  onChooseDay,
}: {
  year: number;
  month: number;
  selected: string;
  firstWeekday: number;
  daysInMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onChooseDay: (day: number) => void;
}) {
  const selectedDate = parseJalaliDate(selected);

  return (
    <div
      dir="rtl"
      style={{
        marginTop: 8,
        border: "1px solid #dbe5df",
        borderRadius: 10,
        background: "#ffffff",
        padding: 8,
        boxShadow: "0 6px 16px rgba(15,23,42,0.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          marginBottom: 7,
        }}
      >
        <button type="button" onClick={onNextMonth} style={calendarNavButtonStyle} aria-label="ماه بعد">
          <ChevronRight size={14} />
        </button>
        <strong style={{ fontSize: 11.5, color: "#0f5138" }}>
          {MONTH_NAMES[month - 1]} {toPersianDigits(year)}
        </strong>
        <button type="button" onClick={onPrevMonth} style={calendarNavButtonStyle} aria-label="ماه قبل">
          <ChevronLeft size={14} />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 3,
          marginBottom: 3,
        }}
      >
        {WEEK_DAYS.map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              fontSize: 9,
              fontWeight: 900,
              color: "#64748b",
              padding: "2px 0",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 3,
        }}
      >
        {Array.from({ length: firstWeekday }).map((_, index) => (
          <span key={`empty-${index}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
          const selectedDay =
            selectedDate?.year === year && selectedDate.month === month && selectedDate.day === day;

          return (
            <button
              key={day}
              type="button"
              onClick={() => onChooseDay(day)}
              style={{
                height: 28,
                border: selectedDay ? "1px solid #0f6b43" : "1px solid #e2e8f0",
                borderRadius: 6,
                background: selectedDay ? "#0f6b43" : "#ffffff",
                color: selectedDay ? "#ffffff" : "#1f2937",
                fontSize: 10.5,
                fontWeight: selectedDay ? 900 : 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {toPersianDigits(day)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const calendarNavButtonStyle: CSSProperties = {
  width: 26,
  height: 26,
  border: "1px solid #dbe5df",
  borderRadius: 6,
  background: "#f8faf9",
  color: "#334155",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
};
