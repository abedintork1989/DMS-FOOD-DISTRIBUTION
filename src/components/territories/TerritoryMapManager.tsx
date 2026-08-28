"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Edit2, Trash2 } from "lucide-react";
import {
  booleanPointInPolygon,
  difference,
  feature,
  featureCollection,
  intersect,
  point as turfPoint,
  polygon,
} from "@turf/turf";
import TerritoryCreateModal from "./TerritoryCreateModal";
import { supabase } from "@/lib/supabase";

// Leaflet فقط در مرورگر اجرا می‌شود؛ جلوگیری از SSR خطای window را حذف می‌کند.
const TerritoryMapCanvas = dynamic(
  () => import("./TerritoryCanvas"),
  { ssr: false }
);

type LatLng = [number, number];
type TerritoryGeometry = LatLng[] | LatLng[][] | LatLng[][][];

type TerritoryRow = {
  id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  province: string;
  county: string;
  activity: string;
  order: number;
  geometry: TerritoryGeometry;
};

type TerritoryInfo = {
  province: string;
  county: string;
  activity: string;
  countyId: string;
  geometry: any;
};

const provinceCodes: Record<string, string> = {
  "مرکزی": "IR-00",
  "گیلان": "IR-01",
  "مازندران": "IR-02",
  "آذربایجان شرقی": "IR-03",
  "آذربایجان غربی": "IR-04",
  "کرمانشاه": "IR-05",
  "خوزستان": "IR-06",
  "فارس": "IR-07",
  "کرمان": "IR-08",
  "خراسان رضوی": "IR-09",
  "اصفهان": "IR-10",
  "سیستان و بلوچستان": "IR-11",
  "کردستان": "IR-12",
  "همدان": "IR-13",
  "چهارمحال و بختیاری": "IR-14",
  "لرستان": "IR-15",
  "ایلام": "IR-16",
  "کهگیلویه و بویراحمد": "IR-17",
  "بوشهر": "IR-18",
  "زنجان": "IR-19",
  "سمنان": "IR-20",
  "یزد": "IR-21",
  "هرمزگان": "IR-22",
  "تهران": "IR-23",
  "اردبیل": "IR-24",
  "قم": "IR-25",
  "قزوین": "IR-26",
  "گلستان": "IR-27",
  "خراسان شمالی": "IR-28",
  "خراسان جنوبی": "IR-29",
  "البرز": "IR-30",
};

function normalizePersianText(value: string): string {
  return (value || "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/[\u200c\u200e\u200f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCountyName(name: string): string {
  return normalizePersianText(
    (name || "").replace(/شهرستان/g, "").replace(/شهر/g, "")
  );
}

function territoryGroupKey(province: string, county: string): string {
  return `${normalizePersianText(province)}\u0000${normalizePersianText(county)}`;
}

function isValidLatLng(point: any): point is LatLng {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    Number.isFinite(Number(point[0])) &&
    Number.isFinite(Number(point[1])) &&
    Number(point[0]) >= -90 &&
    Number(point[0]) <= 90 &&
    Number(point[1]) >= -180 &&
    Number(point[1]) <= 180
  );
}

function sanitizeDraftPoints(points: LatLng[]): LatLng[] {
  return points
    .filter(isValidLatLng)
    .map((p) => [Number(p[0]), Number(p[1])] as LatLng);
}

function extractGeometry(input: any): any | null {
  if (!input) return null;

  let geometry = input;

  if (typeof geometry === "string") {
    try {
      geometry = JSON.parse(geometry);
    } catch {
      return null;
    }
  }

  if (geometry?.type === "FeatureCollection") {
    geometry = geometry.features?.[0]?.geometry ?? null;
  }

  if (geometry?.type === "Feature") {
    geometry = geometry.geometry;
  }

  if (!geometry?.type || !geometry?.coordinates) return null;

  if (
    geometry.type !== "Polygon" &&
    geometry.type !== "MultiPolygon"
  ) {
    return null;
  }

  return geometry;
}

/**
 * GeoJSON -> geometry ذخیره‌شده در دیتابیس
 * Polygon    => [ring, hole, ...]
 * MultiPolygon => [polygon, polygon, ...]
 *
 * نکته مهم: MultiPolygon را flatten نمی‌کنیم؛ چون در غیر این صورت
 * Leaflet آن را به‌عنوان hole/رینگ یک Polygon تفسیر می‌کند.
 */
function geoJsonToTerritoryGeometry(
  geojsonGeometry: any
): TerritoryGeometry | null {
  const geometry = extractGeometry(geojsonGeometry);
  if (!geometry) return null;

  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates
      .map((ring: any[]) =>
        ring
          .filter(
            (p: any) =>
              Array.isArray(p) &&
              Number.isFinite(Number(p[0])) &&
              Number.isFinite(Number(p[1]))
          )
          .map((p: number[]) => [p[1], p[0]] as LatLng)
      )
      .filter((ring: LatLng[]) => ring.length >= 4);

    return rings.length ? rings : null;
  }

  const polygons = geometry.coordinates
    .map((poly: any[]) =>
      poly
        .map((ring: any[]) =>
          ring
            .filter(
              (p: any) =>
                Array.isArray(p) &&
                Number.isFinite(Number(p[0])) &&
                Number.isFinite(Number(p[1]))
            )
            .map((p: number[]) => [p[1], p[0]] as LatLng)
        )
        .filter((ring: LatLng[]) => ring.length >= 4)
    )
    .filter((poly: LatLng[][]) => poly.length > 0);

  return polygons.length ? polygons : null;
}

function storedGeometryToGeoJSON(
  geometry: TerritoryGeometry
): any | null {
  if (!Array.isArray(geometry) || geometry.length === 0) return null;

  const first = geometry[0] as any;

  // geometry قدیمی: [ [lat,lng], ... ]
  if (isValidLatLng(first)) {
    const ring = (geometry as LatLng[]).map(([lat, lng]) => [
      lng,
      lat,
    ]);

    if (ring.length < 3) return null;

    const firstPoint = ring[0];
    const lastPoint = ring[ring.length - 1];

    if (
      firstPoint[0] !== lastPoint[0] ||
      firstPoint[1] !== lastPoint[1]
    ) {
      ring.push([...firstPoint]);
    }

    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [ring],
      },
    };
  }

  // Polygon: [ ring, hole, ... ]
  if (Array.isArray(first) && isValidLatLng(first[0])) {
    const rings = (geometry as LatLng[][]).map((ring) =>
      ring.map(([lat, lng]) => [lng, lat])
    );

    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: rings,
      },
    };
  }

  // MultiPolygon: [ polygon, polygon, ... ]
  if (
    Array.isArray(first) &&
    Array.isArray(first[0]) &&
    isValidLatLng(first[0][0])
  ) {
    const polygons = (geometry as LatLng[][][]).map((poly) =>
      poly.map((ring) =>
        ring.map(([lat, lng]) => [lng, lat])
      )
    );

    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: polygons,
      },
    };
  }

  return null;
}

function draftToPolygon(points: LatLng[]) {
  const cleanPoints = sanitizeDraftPoints(points);

  if (cleanPoints.length < 3) return null;

  const ring = cleanPoints.map(([lat, lng]) => [lng, lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([...first]);
  }

  return polygon([ring]);
}

function turfDifference(base: any, cutter: any): any | null {
  if (!base || !cutter) return base;

  try {
    // Turf جدید
    return (difference as any)(
      featureCollection([base, cutter]) as any
    );
  } catch (newApiError) {
    try {
      // سازگاری با نسخه‌های قدیمی Turf
      return (difference as any)(base, cutter);
    } catch (oldApiError) {
      console.error("TURF DIFFERENCE ERROR", {
        newApiError,
        oldApiError,
      });
      throw oldApiError;
    }
  }
}

function turfIntersect(base: any, cutter: any): any | null {
  try {
    return (intersect as any)(
      featureCollection([base, cutter]) as any
    );
  } catch (newApiError) {
    try {
      // سازگاری با نسخه‌های قدیمی Turf
      return (intersect as any)(base, cutter);
    } catch (oldApiError) {
      console.error("TURF INTERSECT ERROR", {
        newApiError,
        oldApiError,
      });
      throw oldApiError;
    }
  }
}

/**
 * منطق اصلی محدوده:
 *
 * 1) Polygon دستی با مرز شهرستان clip می‌شود.
 * 2) سپس با تک‌تک مناطق قبلی difference می‌گیریم.
 * 3) بنابراین قسمت مشترک فقط از «منطقه جدید» حذف می‌شود
 *    و مناطق قبلی دست‌نخورده باقی می‌مانند.
 *
 * این تابع هم برای preview نقشه و هم برای ذخیره استفاده می‌شود
 * تا چیزی که کاربر روی نقشه می‌بیند دقیقاً همان چیزی باشد که ذخیره می‌شود.
 */
function buildNonOverlappingGeometry(
  points: LatLng[],
  boundary: any,
  territories: TerritoryRow[],
  editingTerritoryId: string | null,
  targetGroupKey: string | null
): {
  geometry: TerritoryGeometry | null;
  hadOverlap: boolean;
} {
  const userPolygon = draftToPolygon(points);

  if (!userPolygon) {
    return {
      geometry: null,
      hadOverlap: false,
    };
  }

  let current: any = userPolygon;

  // ابتدا برش با مرز شهرستان
  if (boundary) {
    const countyGeometry = extractGeometry(boundary);

    if (!countyGeometry) {
      return {
        geometry: null,
        hadOverlap: false,
      };
    }

    const countyFeature = feature(countyGeometry as any);
    const clipped = turfIntersect(current, countyFeature as any);

    if (!clipped?.geometry) {
      return {
        geometry: null,
        hadOverlap: false,
      };
    }

    current = clipped;
  }

  let hadOverlap = false;

  // سپس حذف قسمت‌های مشترک با مناطق قبلی
  for (const territory of territories) {
    if (editingTerritoryId && territory.id === editingTerritoryId) {
      continue;
    }

    // همپوشانی فقط با مناطق همان استان/شهرستان بررسی می‌شود.
    // مناطق شهرستان‌های دیگر نباید روی رسم این شهرستان اثر بگذارند.
    if (
      targetGroupKey &&
      territoryGroupKey(territory.province, territory.county) !== targetGroupKey
    ) {
      continue;
    }

    const existingFeature = storedGeometryToGeoJSON(
      territory.geometry
    );

    if (!existingFeature) continue;

    const overlap = turfIntersect(current, existingFeature);

    const overlapGeometryType = overlap?.geometry?.type;

    // فقط همپوشانی دارای مساحت مهم است؛ تماس صرفاً روی یک خط/نقطه
    // نباید به‌عنوان overlap در نظر گرفته شود.
    const hasAreaOverlap =
      overlapGeometryType === "Polygon" ||
      overlapGeometryType === "MultiPolygon";

    if (hasAreaOverlap) {
      hadOverlap = true;
      const remaining = turfDifference(current, existingFeature);

      if (!remaining?.geometry) {
        current = null;
        break;
      }

      current = remaining;
    }
  }

  if (!current?.geometry) {
    return {
      geometry: null,
      hadOverlap,
    };
  }

  return {
    geometry: geoJsonToTerritoryGeometry(current.geometry),
    hadOverlap,
  };
}

export default function TerritoryMapManager() {
  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<LatLng[]>([]);
  const [territories, setTerritories] = useState<TerritoryRow[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [territoryInfo, setTerritoryInfo] =
    useState<TerritoryInfo | null>(null);
  const [editingTerritoryId, setEditingTerritoryId] =
    useState<string | null>(null);
  const [countyBoundary, setCountyBoundary] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [focusTerritoryId, setFocusTerritoryId] = useState<string | null>(null);
  // فقط بعد از فشردن «پاک کردن محدوده»، محدوده قبلی در حالت ویرایش از روی نقشه پنهان می‌شود.
  const [redrawTerritoryId, setRedrawTerritoryId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");

  async function loadTerritories() {
    // province/county در sales_territories وابسته به نسخه دیتابیس هستند و
    // در بعضی نسخه‌ها اصلاً ستون نیستند. منبع اصلی سلسله‌مراتب جدول territories است.
    const { data, error } = await supabase
      .from("sales_territories")
      .select("id,name,code,parent_id,geometry,activity,order")
      .order("order", { ascending: true });

    if (error) {
      console.error(
        "LOAD TERRITORIES ERROR",
        error?.message || JSON.stringify(error, null, 2)
      );
      return;
    }

    const rows = (data || []) as any[];

    // کل درخت جغرافیایی را یک‌بار می‌خوانیم تا استان و شهرستان را
    // بدون وابستگی به ستون‌های province/county در sales_territories بسازیم.
    const { data: hierarchyData, error: hierarchyError } = await supabase
      .from("territories")
      .select("id,name,type,parent_id");

    if (hierarchyError) {
      console.warn("LOAD TERRITORY HIERARCHY ERROR", hierarchyError.message);
    }

    const hierarchyById = new Map<string, any>(
      (hierarchyData || []).map((item: any) => [String(item.id), item])
    );

    const resolveGeography = (parentId: string | null) => {
      let countyItem = parentId ? hierarchyById.get(String(parentId)) : null;
      let provinceItem = countyItem?.parent_id
        ? hierarchyById.get(String(countyItem.parent_id))
        : null;

      // اگر یک رکورد قدیمی مستقیماً به استان وصل شده باشد، حداقل نام استان
      // را حفظ می‌کنیم و شهرستان را خالی می‌گذاریم.
      const county = countyItem?.name || "";
      const province = provinceItem?.name || "";

      return { province, county };
    };

    const enriched = rows.map((item) => {
      const geography = resolveGeography(item.parent_id ?? null);

      return {
        id: String(item.id),
        name: item.name || `منطقه ${Number(item.order) || 1}`,
        code: item.code ?? null,
        parent_id: item.parent_id ?? null,
        province: geography.province,
        county: geography.county,
        activity: item.activity || "",
        order: Number(item.order) || 0,
        geometry: item.geometry as TerritoryGeometry,
      } as TerritoryRow;
    });

    // ترتیب نهایی در هر شهرستان مستقل است؛ هر شهرستان از منطقه ۱ شروع می‌شود.
    const grouped = new Map<string, TerritoryRow[]>();
    for (const item of enriched) {
      const key = territoryGroupKey(item.province, item.county);
      const list = grouped.get(key) ?? [];
      list.push(item);
      grouped.set(key, list);
    }

    const normalizedTerritories: TerritoryRow[] = [];
    for (const list of grouped.values()) {
      list
        .sort((a, b) => {
          const orderDiff = (Number(a.order) || 0) - (Number(b.order) || 0);
          if (orderDiff !== 0) return orderDiff;
          return String(a.id).localeCompare(String(b.id));
        })
        .forEach((item, index) => {
          const localOrder = index + 1;
          normalizedTerritories.push({
            ...item,
            order: localOrder,
            name: normalizePersianText(item.name) || `منطقه ${localOrder}`,
          });
        });
    }

    setTerritories(normalizedTerritories);
  }

  // شماره منطقه همیشه داخل همان شهرستان محاسبه می‌شود؛
  // بنابراین شهرستان جدید از منطقه ۱ شروع می‌شود و به شهرستان‌های دیگر وابسته نیست.
  const localOrderById = useMemo(() => {
    const map = new Map<string, number>();

    const groups = new Map<string, TerritoryRow[]>();

    for (const item of territories) {
      const key = `${normalizePersianText(item.province)}\u0000${normalizePersianText(
        item.county
      )}`;

      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }

    for (const list of groups.values()) {
      list
        .sort((a, b) => {
          const orderDiff = (Number(a.order) || 0) - (Number(b.order) || 0);
          if (orderDiff !== 0) return orderDiff;
          return String(a.id).localeCompare(String(b.id));
        })
        .forEach((item, index) => map.set(item.id, index + 1));
    }

    return map;
  }, [territories]);

  function getTerritoryGroupKey(item: Pick<TerritoryRow, "province" | "county">) {
    return `${normalizePersianText(item.province)}\u0000${normalizePersianText(
      item.county
    )}`;
  }

  useEffect(() => {
    void loadTerritories();
  }, []);

  function isPointInsideCountyBoundary(pointValue: LatLng): boolean {
    if (!countyBoundary) return false;

    try {
      const geometry = extractGeometry(countyBoundary);
      if (!geometry) return false;

      return booleanPointInPolygon(
        turfPoint([pointValue[1], pointValue[0]]),
        feature(geometry as any) as any
      );
    } catch (error) {
      console.error("COUNTY POINT VALIDATION ERROR", error);
      return false;
    }
  }

  function addPoint(pointValue: LatLng) {
    if (!drawing || !isValidLatLng(pointValue)) return;

    // عمداً اجازه می‌دهیم نقطه حتی خارج از شهرستان ثبت شود.
    // در مرحله preview و ذخیره، کل Polygon با مرز شهرستان clip می‌شود.
    setDraftPoints((prev) => [...prev, pointValue]);
  }

  function movePoint(index: number, pointValue: LatLng) {
    if (!isValidLatLng(pointValue)) return;

    // جابه‌جایی نقطه نیز می‌تواند خارج از شهرستان باشد؛ نتیجه نهایی
    // در buildNonOverlappingGeometry به مرز شهرستان محدود می‌شود.
    setDraftPoints((prev) => {
      if (index < 0 || index >= prev.length) return prev;

      const copy = [...prev];
      copy[index] = pointValue;
      return copy;
    });
  }

  async function findCountyBoundary(
    data: TerritoryInfo
  ): Promise<any | null> {
    const provinceCode = provinceCodes[data.province];

    if (!provinceCode) return null;

    const url = `/data/counties/${provinceCode}/${provinceCode}.all.geojson`;

    try {
      const response = await fetch(url);

      if (!response.ok) return null;

      const json = await response.json();
      const selectedCounty = normalizeCountyName(data.county);

      const countyFeature = (json.features || []).find(
        (f: any) => {
          const geoCounty = normalizeCountyName(
            f.properties?.tags?.name || ""
          );

          return geoCounty === selectedCounty;
        }
      );

      return countyFeature?.geometry ?? null;
    } catch (error) {
      console.error("LOAD GEOJSON ERROR", error);
      return null;
    }
  }

  async function startCreate(data: TerritoryInfo) {
    const boundary = await findCountyBoundary(data);

    if (!boundary) {
      alert(
        "مرز این شهرستان پیدا نشد و برش خودکار انجام نخواهد شد."
      );
    }

    setCountyBoundary(boundary);
    setTerritoryInfo(data);
    setCreateModalOpen(false);
    setDraftPoints([]);
    setEditingTerritoryId(null);
    setRedrawTerritoryId(null);
    setDrawing(true);
  }

  const previewGeometry = useMemo(() => {
    if (!drawing || draftPoints.length < 3) return null;

    try {
      return buildNonOverlappingGeometry(
        draftPoints,
        countyBoundary,
        territories,
        editingTerritoryId,
        territoryInfo
          ? territoryGroupKey(territoryInfo.province, territoryInfo.county)
          : null
      ).geometry;
    } catch (error) {
      console.error("PREVIEW GEOMETRY ERROR", error);
      return null;
    }
  }, [
    drawing,
    draftPoints,
    countyBoundary,
    territories,
    editingTerritoryId,
  ]);

  async function saveTerritory() {
    if (saving) return;

    if (!territoryInfo) {
      alert("اطلاعات شهرستان موجود نیست");
      return;
    }

    const cleanDraft = sanitizeDraftPoints(draftPoints);

    if (cleanDraft.length < 3) {
      alert("حداقل ۳ نقطه انتخاب کنید");
      return;
    }

    setSaving(true);

    try {
      const result = buildNonOverlappingGeometry(
        cleanDraft,
        countyBoundary,
        territories,
        editingTerritoryId,
        territoryInfo
          ? territoryGroupKey(territoryInfo.province, territoryInfo.county)
          : null
      );

      if (!result.geometry) {
        if (result.hadOverlap) {
          alert(
            "کل محدوده جدید با مناطق قبلی همپوشانی دارد و چیزی برای ثبت باقی نمانده است."
          );
        } else {
          alert(
            "قسمت انتخاب‌شده با مرز شهرستان اشتراک معتبری ندارد."
          );
        }

        return;
      }

      if (result.hadOverlap) {
        alert(
          "هشدار: بخش‌های همپوشان با مناطق قبلی به‌صورت خودکار از منطقه جدید حذف شدند."
        );
      }

      const currentOrder = editingTerritoryId
        ? localOrderById.get(editingTerritoryId) ?? 1
        : territories.filter(
            (item) =>
              getTerritoryGroupKey(item) ===
              getTerritoryGroupKey(territoryInfo)
          ).length + 1;

      const territoryName = `منطقه ${currentOrder}`;

      if (editingTerritoryId) {
        const existingTerritory = territories.find(
          (item) => item.id === editingTerritoryId
        );

        const payload = {
          // در ویرایش هندسه، نام سفارشی منطقه هرگز نباید به «منطقه N» برگردد.
          name: existingTerritory?.name || territoryName,
          // در ساختار صحیح، parent_id به رکورد شهرستان در جدول territories اشاره می‌کند.
          parent_id: territoryInfo.countyId || null,
          activity: territoryInfo.activity,
          order: currentOrder,
          geometry: result.geometry,
        };

        let updateResult = await supabase
          .from("sales_territories")
          .update(payload)
          .eq("id", editingTerritoryId);

        // اگر دیتابیس هنوز FK قدیمی را دارد، یک بار با parent_id خالی تلاش می‌کنیم.
        if (updateResult.error?.code === "23503") {
          console.warn(
            "[Territory] parent_id FK is incompatible; retrying update with NULL parent_id."
          );
          updateResult = await supabase
            .from("sales_territories")
            .update({ ...payload, parent_id: null })
            .eq("id", editingTerritoryId);
        }

        if (updateResult.error) {
          const error = updateResult.error;
          const message = [
            error?.message,
            error?.details,
            error?.hint,
            error?.code ? `(${error.code})` : "",
          ].filter(Boolean).join(" | ");
          console.error("SAVE UPDATE ERROR", message || error);
          alert(`خطا در ذخیره محدوده: ${message || "خطای نامشخص"}`);
          return;
        }
      } else {
        const payload = {
          name: territoryName,
          code: `ST-${crypto.randomUUID()}`,
          // در ساختار صحیح، parent_id شناسه شهرستان از جدول territories است.
          parent_id: territoryInfo.countyId || null,
          activity: territoryInfo.activity,
          order: currentOrder,
          geometry: result.geometry,
        };

        let insertResult = await supabase
          .from("sales_territories")
          .insert(payload);

        // سازگاری با دیتابیس قدیمی: در صورت FK خطادار، ثبت را با NULL تکرار می‌کنیم.
        if (insertResult.error?.code === "23503") {
          console.warn(
            "[Territory] parent_id FK is incompatible; retrying insert with NULL parent_id."
          );
          insertResult = await supabase
            .from("sales_territories")
            .insert({ ...payload, parent_id: null });
        }

        if (insertResult.error) {
          const error = insertResult.error;
          const message = [
            error?.message,
            error?.details,
            error?.hint,
            error?.code ? `(${error.code})` : "",
          ].filter(Boolean).join(" | ");
          console.error("SAVE INSERT ERROR", message || error);
          alert(`خطا در ذخیره محدوده: ${message || "خطای نامشخص"}`);
          return;
        }
      }

      await loadTerritories();

      setDraftPoints([]);
      setDrawing(false);
      setEditingTerritoryId(null);
      setRedrawTerritoryId(null);
      setEditingNameId(null);
      setEditingNameValue("");
      setTerritoryInfo(null);
      setCountyBoundary(null);
    } catch (error: any) {
      console.error("SAVE TERRITORY ERROR", error);

      alert(
        `خطا در پردازش محدوده: ${
          error?.message || "هندسه محدوده معتبر نیست"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  function getEditableOuterRing(
    geometry: TerritoryGeometry
  ): LatLng[] {
    if (!Array.isArray(geometry) || geometry.length === 0) {
      return [];
    }

    const first = geometry[0] as any;

    // geometry قدیمی: [ [lat,lng], ... ]
    if (isValidLatLng(first)) {
      return (geometry as LatLng[]).filter(isValidLatLng);
    }

    // Polygon: [ ring, hole, ... ]
    if (Array.isArray(first) && isValidLatLng(first[0])) {
      return (first as LatLng[]).filter(isValidLatLng);
    }

    // MultiPolygon: [ polygon, polygon, ... ]
    if (
      Array.isArray(first) &&
      Array.isArray(first[0]) &&
      isValidLatLng(first[0][0])
    ) {
      return (first[0] as LatLng[]).filter(isValidLatLng);
    }

    return [];
  }

  async function editTerritory(item: TerritoryRow) {
    // هنگام اصلاح، همان مرز شهرستانِ متعلق به منطقه را دوباره بارگذاری می‌کنیم
    // تا مرز همیشه روی نقشه مشخص باشد. نقطه‌ها می‌توانند خارج از مرز هم باشند؛
    // فقط بخش نهایی Polygon داخل شهرستان نگه داشته می‌شود.
    const info: TerritoryInfo = {
      province: item.province,
      county: item.county,
      activity: item.activity,
      countyId: item.parent_id || "",
      geometry: item.geometry,
    };

    const boundary = await findCountyBoundary(info);

    if (!boundary) {
      alert(
        `مرز شهرستان «${item.county || "نامشخص"}» پیدا نشد.\n\nبرای جلوگیری از رسم اشتباه، ویرایش این محدوده شروع نشد.`
      );
      return;
    }

    setEditingTerritoryId(item.id);
    setTerritoryInfo(info);
    setCountyBoundary(boundary);
    setDraftPoints(getEditableOuterRing(item.geometry));
    setRedrawTerritoryId(null);
    setFocusTerritoryId(item.id);
    setDrawing(true);
  }

  function clearTerritoryForRedraw() {
    if (!editingTerritoryId) return;

    setDraftPoints([]);
    setRedrawTerritoryId(editingTerritoryId);
  }

  function startRenameTerritory(item: TerritoryRow) {
    setEditingNameId(item.id);
    setEditingNameValue(item.name || `منطقه ${localOrderById.get(item.id) ?? 1}`);
  }

  async function saveTerritoryName(item: TerritoryRow, selectedValue?: string) {
    if (editingNameId !== item.id) return;

    const nextName = normalizePersianText(
      selectedValue ?? editingNameValue
    );
    const currentName = normalizePersianText(
      item.name || `منطقه ${localOrderById.get(item.id) ?? 1}`
    );

    if (!nextName || nextName === currentName) {
      setEditingNameId(null);
      return;
    }

    const sameCounty = territories.filter(
      (candidate) =>
        candidate.id !== item.id &&
        getTerritoryGroupKey(candidate) === getTerritoryGroupKey(item)
    );

    const target = sameCounty.find(
      (candidate) =>
        normalizePersianText(
          candidate.name || `منطقه ${localOrderById.get(candidate.id) ?? 1}`
        ) === nextName
    );

    // اگر نام انتخاب‌شده متعلق به یک منطقه دیگر باشد، نام دو منطقه جابه‌جا می‌شود.
    // این کار باعث می‌شود شماره/نام منطقه در شهرستان همیشه یکتا بماند.
    const updates: { id: string; name: string }[] = target
      ? [
          { id: item.id, name: nextName },
          { id: target.id, name: currentName },
        ]
      : [{ id: item.id, name: nextName }];

    try {
      for (const update of updates) {
        const { error } = await supabase
          .from("sales_territories")
          .update({ name: update.name })
          .eq("id", update.id);

        if (error) throw error;
      }

      setTerritories((prev) =>
        prev.map((candidate) => {
          const update = updates.find((entry) => entry.id === candidate.id);
          return update ? { ...candidate, name: update.name } : candidate;
        })
      );
      setEditingNameId(null);
      setEditingNameValue("");
    } catch (error: any) {
      console.error("RENAME TERRITORY ERROR", error);
      alert(`خطا در تغییر نام منطقه: ${error?.message || "خطای نامشخص"}`);
    }
  }

  async function removeTerritory(id: string) {
    const { error } = await supabase
      .from("sales_territories")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("DELETE TERRITORY ERROR", error);
      return;
    }

    await loadTerritories();
  }

  return (
    <>
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      >
        <TerritoryMapCanvas
          drawing={drawing}
          draftPoints={draftPoints}
          territories={territories}
          countyBoundary={countyBoundary}
          previewGeometry={previewGeometry}
          onMapPoint={addPoint}
          onMovePoint={movePoint}
          focusTerritoryId={focusTerritoryId}
          hiddenTerritoryId={redrawTerritoryId}
        />

        {!panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            style={{
              position: "fixed",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              width: 45,
              height: 90,
              background: "#16a34a",
              color: "#fff",
              border: 0,
              borderRadius: "15px 0 0 15px",
              zIndex: 5000,
              cursor: "pointer",
            }}
          >
            ☰
          </button>
        )}

        <div
          style={{
            position: "fixed",
            top: 86,
            right: 0,
            bottom: 0,
            width: 520,
            background: "#fff",
            zIndex: 4000,
            transform: panelOpen
              ? "translateX(0)"
              : "translateX(100%)",
            transition: "transform .35s ease",
          }}
        >
          <div
            style={{
              padding: 20,
              height: "100%",
              overflow: "auto",
              direction: "rtl",
            }}
          >
            <button
              onClick={() => setPanelOpen(false)}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: 0,
                background: "#16a34a",
                color: "#fff",
              }}
            >
              ×
            </button>

            <button
              onClick={() => setCreateModalOpen(true)}
              style={{
                width: "100%",
                marginTop: 25,
                padding: 15,
                background: "#16a34a",
                color: "#fff",
                border: 0,
                borderRadius: 12,
                fontWeight: 900,
              }}
            >
              + ایجاد منطقه جدید
            </button>

            {drawing && editingTerritoryId && (
              <button
                type="button"
                onClick={clearTerritoryForRedraw}
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: 11,
                  background: "#fff",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                پاک کردن محدوده و رسم مجدد
              </button>
            )}

            {drawing && (
              <button
                onClick={saveTerritory}
                disabled={saving}
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: 14,
                  background: saving
                    ? "#86a98f"
                    : "#15803d",
                  color: "#fff",
                  border: 0,
                  borderRadius: 10,
                  cursor: saving ? "wait" : "pointer",
                }}
              >
                {saving ? "در حال ثبت..." : "ثبت محدوده"}
              </button>
            )}

            <h3>مناطق ثبت شده</h3>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th>رنگ</th>
                  <th>نام منطقه</th>
                  <th>استان</th>
                  <th>شهرستان</th>
                  <th>فعالیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>

              <tbody>
                {[...territories]
                  .sort((a, b) => {
                    const provinceCompare = normalizePersianText(a.province).localeCompare(
                      normalizePersianText(b.province),
                      "fa"
                    );
                    if (provinceCompare !== 0) return provinceCompare;

                    const countyCompare = normalizePersianText(a.county).localeCompare(
                      normalizePersianText(b.county),
                      "fa"
                    );
                    if (countyCompare !== 0) return countyCompare;

                    return (localOrderById.get(a.id) ?? 0) - (
                      localOrderById.get(b.id) ?? 0
                    );
                  })
                  .map((item) => {
                    const localOrder = localOrderById.get(item.id) ?? 1;
                    return (
                    <tr
                      key={item.id}
                      onClick={() =>
                        setFocusTerritoryId(item.id)
                      }
                      style={{
                        cursor: "pointer",
                        transition: "background .15s ease",
                      }}
                    >
                      <td style={{ width: 44, textAlign: "center" }}>
                        <span
                          title={`رنگ منطقه ${localOrder}`}
                          style={{
                            display: "inline-block",
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            background: [
                              "#2563eb",
                              "#dc2626",
                              "#16a34a",
                              "#9333ea",
                              "#ea580c",
                              "#0891b2",
                              "#ca8a04",
                              "#db2777",
                            ][Math.max(0, localOrder - 1) % 8],
                            border: "1px solid rgba(0,0,0,.15)",
                            verticalAlign: "middle",
                          }}
                        />
                      </td>
                      <td
                        onClick={(event) => event.stopPropagation()}
                        title="برای تغییر نام، کلیک کنید"
                        style={{
                          minWidth: 145,
                          fontWeight: 700,
                        }}
                      >
                        {editingNameId === item.id ? (
                          <select
                            autoFocus
                            value={editingNameValue || item.name || `منطقه ${localOrder}`}
                            onChange={(event) => {
                              const value = event.target.value;
                              setEditingNameValue(value);
                              void saveTerritoryName(item, value);
                            }}
                            onBlur={() => {
                              setEditingNameId(null);
                              setEditingNameValue("");
                            }}
                            onClick={(event) => event.stopPropagation()}
                            style={{
                              width: "100%",
                              minWidth: 130,
                              padding: "7px 8px",
                              border: "1px solid #2563eb",
                              borderRadius: 8,
                              outline: "none",
                              direction: "rtl",
                              fontFamily: "inherit",
                              fontWeight: 700,
                              background: "#fff",
                              boxSizing: "border-box",
                              cursor: "pointer",
                            }}
                          >
                            <option value={item.name || `منطقه ${localOrder}`}>
                              {item.name || `منطقه ${localOrder}`}
                            </option>
                            {territories
                              .filter(
                                (candidate) =>
                                  candidate.id !== item.id &&
                                  getTerritoryGroupKey(candidate) ===
                                    getTerritoryGroupKey(item)
                              )
                              .sort(
                                (a, b) =>
                                  (localOrderById.get(a.id) ?? 0) -
                                  (localOrderById.get(b.id) ?? 0)
                              )
                              .map((candidate) => {
                                const candidateName =
                                  candidate.name ||
                                  `منطقه ${localOrderById.get(candidate.id) ?? 1}`;
                                return (
                                  <option key={candidate.id} value={candidateName}>
                                    {candidateName}
                                  </option>
                                );
                              })}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              startRenameTerritory(item);
                            }}
                            title="برای تغییر نام، لیست مناطق شهرستان را باز کنید"
                            style={{
                              border: 0,
                              background: "transparent",
                              padding: 0,
                              margin: 0,
                              color: "inherit",
                              font: "inherit",
                              cursor: "pointer",
                              textAlign: "right",
                              width: "100%",
                            }}
                          >
                            {item.name || `منطقه ${localOrder}`}
                          </button>
                        )}
                      </td>
                      <td>{item.province}</td>
                      <td>{item.county}</td>
                      <td>{item.activity}</td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                          }}
                        >
                          <button
                            type="button"
                            title="ویرایش"
                            aria-label="ویرایش"
                            onClick={(event) => {
                              event.stopPropagation();
                              editTerritory(item);
                            }}
                            style={{
                              width: 28,
                              height: 28,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              background: "#2563eb",
                              color: "#fff",
                              border: 0,
                              borderRadius: 6,
                              cursor: "pointer",
                            }}
                          >
                            <Edit2 size={14} strokeWidth={2} />
                          </button>

                          <button
                            type="button"
                            title="حذف"
                            aria-label="حذف"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeTerritory(item.id);
                            }}
                            style={{
                              width: 28,
                              height: 28,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              background: "#ef4444",
                              color: "#fff",
                              border: 0,
                              borderRadius: 6,
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={14} strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <TerritoryCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onStart={startCreate}
      />
    </>
  );
}
