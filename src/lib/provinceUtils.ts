// ابزارهای مشترک برای صفحه نقشه: نرمال‌سازی نام استان و محاسبه رنگ نقشه حرارتی

/**
 * نام استان را نرمال می‌کند تا نام‌های ذخیره‌شده در جدول مشتریان
 * (که از Nominatim یا ورود دستی می‌آیند) با نام استان‌ها در فایل GeoJSON مطابقت پیدا کنند.
 * مثال: "استان تهران" و "تهران" هر دو باید به یک مقدار نرمال برسند.
 */
export function normalizeProvinceName(raw: string | null | undefined): string {
  if (!raw) return "";

  let name = raw.trim();

  // حذف پیشوند/پسوند «استان»
  name = name.replace(/^استان\s+/, "").replace(/\s+استان$/, "");

  // حذف کاراکترهای جهت‌ساز نامرئی که گاهی در متن عربی/فارسی می‌آیند
  name = name.replace(/[\u200e\u200f\u202a-\u202e]/g, "");

  // یکسان‌سازی «ی» و «ک» عربی با فارسی (اختلاف رایج بین منابع مختلف)
  name = name.replace(/ي/g, "ی").replace(/ك/g, "ک");

  return name.trim();
}

/**
 * لیست ۳۱ استان کشور (برای اعتبارسنجی و نمایش گزینه‌های فیلتر در صورت نیاز)
 */
export const IRAN_PROVINCE_NAMES = [
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

/**
 * رنگ هر استان را بر اساس تعداد مشتریان آن نسبت به بیشترین مقدار محاسبه می‌کند.
 * از یک طیف سبز (کم‌رنگ تا پررنگ) استفاده می‌شود.
 */
export function getProvinceFillColor(count: number, maxCount: number): string {
  if (count <= 0) return "#eef2f6";
  if (maxCount <= 0) return "#eef2f6";

  const ratio = Math.min(count / maxCount, 1);

  // طیف سبز از خیلی کم‌رنگ (#d7f2e3) تا پررنگ (#0f6b43)
  const stops: [number, string][] = [
    [0, "#d7f2e3"],
    [0.25, "#a6e3c3"],
    [0.5, "#5fc899"],
    [0.75, "#2ba36f"],
    [1, "#0f6b43"],
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const [from, fromColor] = stops[i];
    const [to, toColor] = stops[i + 1];

    if (ratio >= from && ratio <= to) {
      const localRatio = to === from ? 0 : (ratio - from) / (to - from);
      return interpolateColor(fromColor, toColor, localRatio);
    }
  }

  return stops[stops.length - 1][1];
}

function interpolateColor(colorA: string, colorB: string, ratio: number): string {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);

  const r = Math.round(a.r + (b.r - a.r) * ratio);
  const g = Math.round(a.g + (b.g - a.g) * ratio);
  const bChannel = Math.round(a.b + (b.b - a.b) * ratio);

  return `rgb(${r}, ${g}, ${bChannel})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 * برچسب فارسی وضعیت تسویه بر اساس مقدار عددی ذخیره‌شده
 */
export function settlementLabel(days: number | null | undefined): string {
  if (days === 0 || days === null || days === undefined) return "نقدی";
  if (days === -1) return "بدون محدودیت";
  return `${new Intl.NumberFormat("fa-IR").format(days)} روز`;
}
