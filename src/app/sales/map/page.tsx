"use client";
import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getProvinceFillColor, normalizeProvinceName } from "@/lib/provinceUtils";

const markerPulseStyle = `
@keyframes customerPulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.8); opacity: 0.45; }
  100% { transform: scale(1); opacity: 1; }
}
`;


function createCustomerDot() {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:10px;
        height:10px;
        border-radius:50%;
        background:#dc2626;
        border:2px solid white;
        box-shadow:0 0 8px #dc2626;
        animation: customerPulse 1.2s infinite;
      "></div>
    `,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

function createCustomerVipCircle() {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:18px;
        height:18px;
        border-radius:50%;
        background:#d4af37;
        border:3px solid #0f172a;
        box-shadow:0 0 0 2px rgba(255,255,255,0.95),0 0 8px rgba(212,175,55,0.85);
        box-sizing:border-box;
      "></div>
    `,
    iconSize:[18,18],
    iconAnchor:[9,9],
  });
}

function createCustomerStar() {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:18px;
        height:18px;
        display:flex;
        align-items:center;
        justify-content:center;
        animation: customerPulse 1.2s infinite;
        filter:drop-shadow(0 0 4px #d4af37);\n        border:3px solid #0f172a;\n        border-radius:50%;\n        box-sizing:border-box;\n        background:rgba(255,255,255,0.95);
      ">
        <span style="
          color:#d4af37;
          font-size:20px;
          line-height:18px;
          text-shadow:0 0 2px white,0 0 4px #d4af37;
        ">★</span>
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// محدوده تقریبی کشور ایران — نقشه اجازه خروج از این محدوده را نمی‌دهد
const IRAN_BOUNDS: [[number, number], [number, number]] = [
  [24.0, 43.0],
  [40.5, 63.5],
];

const IRAN_CENTER: [number, number] = [32.4279, 53.688];

// نقشه‌ی نام‌های انگلیسی رایج در فایل‌های GeoJSON به نام فارسی استان‌ها.
// اگر normalizeProvinceName نام را به فارسی برنگرداند (مثلاً چون در GeoJSON
// اسم استان انگلیسی ذخیره شده)، از این جدول به‌عنوان پشتیبان استفاده می‌شود
// تا روی نقشه همیشه نام فارسی نمایش داده شود.
const PROVINCE_NAME_FA: Record<string, string> = {
  tehran: "تهران",
  qom: "قم",
  markazi: "مرکزی",
  qazvin: "قزوین",
  gilan: "گیلان",
  ardabil: "اردبیل",
  "zanjan": "زنجان",
  "east azerbaijan": "آذربایجان شرقی",
  "azarbaijan-e sharqi": "آذربایجان شرقی",
  "west azerbaijan": "آذربایجان غربی",
  "azarbaijan-e gharbi": "آذربایجان غربی",
  kurdistan: "کردستان",
  kordestan: "کردستان",
  hamadan: "همدان",
  kermanshah: "کرمانشاه",
  ilam: "ایلام",
  lorestan: "لرستان",
  khuzestan: "خوزستان",
  chaharmahal: "چهارمحال و بختیاری",
  "chaharmahal and bakhtiari": "چهارمحال و بختیاری",
  "kohgiluyeh and boyer-ahmad": "کهگیلویه و بویراحمد",
  kohgiluyeh: "کهگیلویه و بویراحمد",
  bushehr: "بوشهر",
  fars: "فارس",
  hormozgan: "هرمزگان",
  "sistan and baluchestan": "سیستان و بلوچستان",
  kerman: "کرمان",
  "south khorasan": "خراسان جنوبی",
  "khorasan-e jonubi": "خراسان جنوبی",
  "razavi khorasan": "خراسان رضوی",
  "khorasan-e razavi": "خراسان رضوی",
  "north khorasan": "خراسان شمالی",
  "khorasan-e shomali": "خراسان شمالی",
  semnan: "سمنان",
  mazandaran: "مازندران",
  golestan: "گلستان",
  alborz: "البرز",
  yazd: "یزد",
  isfahan: "اصفهان",
  esfahan: "اصفهان",
};

function hasPersianChars(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

// نام قابل‌نمایش استان را همیشه به فارسی برمی‌گرداند
function displayProvinceNameFa(rawName: string, normalizedName: string) {
  if (normalizedName && hasPersianChars(normalizedName)) return normalizedName;
  if (rawName && hasPersianChars(rawName)) return rawName;

  const key = String(rawName || "").trim().toLowerCase();
  return PROVINCE_NAME_FA[key] || normalizedName || rawName || "نامشخص";
}

export type MapCustomer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  province: string | null;
  visitor: string | null;
  settlement_days: number | null;
  latitude: number;
  longitude: number;
  active: boolean;
  customer_type: string | null;
};

function FitIranBounds() {
  const map = useMap();

  useEffect(() => {
    map.setMaxBounds(IRAN_BOUNDS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function CustomerMarkers({
  customers,
}: {
  customers: MapCustomer[];
}) {
  return (
    <>
      {customers.map((c) => {
        const customerType = String(c.customer_type ?? "")
          .normalize("NFKC")
          .trim()
          .replace(/\u200c/g, "")
          .replace(/ي/g, "ی")
          .replace(/ك/g, "ک")
          .replace(/[\sـ]+/g, "")
          .toLowerCase();

        const isChainCustomer =
          customerType.includes("زنجیره") ||
          customerType.includes("chain");

        const isVipCustomer =
          customerType === "vip";

        const icon = isChainCustomer
          ? createCustomerStar()
          : isVipCustomer
          ? createCustomerVipCircle()
          : createCustomerDot();

        return (
          <Marker
            key={c.id}
            position={[c.latitude, c.longitude]}
            icon={icon}
            zIndexOffset={1000}
          >
          <Popup>
            <div style={{ minWidth: 180, fontFamily: "inherit" }}>
              <strong style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
                {c.name}
              </strong>

              {c.address && (
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
                  {c.address}
                </div>
              )}

              {c.phone && (
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
                  تلفن: {c.phone}
                </div>
              )}

              {c.visitor && (
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>
                  ویزیتور: {c.visitor}
                </div>
              )}

              <a
                href={`/customers/${c.id}`}
                style={{
                  display: "inline-block",
                  marginTop: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#0f6b43",
                  textDecoration: "none",
                }}
              >
                مشاهده پرونده مشتری ←
              </a>
            </div>
          </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function ProvincesLayer({
  provincesGeoJson,
  provinceCounts,
  maxProvinceCount,
  selectedProvince,
  onSelectProvince,
}: {
  provincesGeoJson: any;
  provinceCounts: Record<string, number>;
  maxProvinceCount: number;
  selectedProvince: string | null;
  onSelectProvince: (name: string | null) => void;
}) {
  const geoJsonKey = useMemo(
    () => JSON.stringify(provinceCounts) + "|" + (selectedProvince || ""),
    [provinceCounts, selectedProvince]
  );

  function styleFn(feature: any) {
    const name = normalizeProvinceName(feature?.properties?.name);
    const count = provinceCounts[name] || 0;
    const isSelected = selectedProvince === name;

    return {
      fillColor: getProvinceFillColor(count, maxProvinceCount),
      fillOpacity: isSelected ? 0.4 : 0.2,
      // خطوط مرز استان‌ها قرمز
      color: "#dc2626",
      weight: isSelected ? 3 : 1,
    };
  }

  function onEachFeature(feature: any, layer: L.Layer) {
    const name = normalizeProvinceName(feature?.properties?.name);
    const faName = displayProvinceNameFa(feature?.properties?.name, name);
    const count = provinceCounts[name] || 0;

    // برچسب فقط هنگام هاور نمایش داده می‌شود (نه به‌صورت دائمی روی نقشه)
    // و همیشه با نام فارسی استان است.
    layer.bindTooltip(`${faName} — ${count.toLocaleString("fa-IR")} مشتری`, {
      permanent: false,
      direction: "center",
      className: "province-hover-label",
    });

    layer.on("click", () => {
      onSelectProvince(selectedProvince === name ? null : name);
    });

    layer.on("mouseover", (e: any) => {
      e.target.setStyle({ weight: 5, color: "#dc2626" });
    });

    layer.on("mouseout", (e: any) => {
      if (normalizeProvinceName(feature?.properties?.name) !== selectedProvince) {
        e.target.setStyle({ weight: 3, color: "#dc2626" });
      }
    });
  }

  return (
    <GeoJSON
      key={geoJsonKey}
      data={provincesGeoJson}
      style={styleFn}
      onEachFeature={onEachFeature}
    />
  );
}

function ProvinceBordersLayer({
  provincesGeoJson,
}: {
  provincesGeoJson: any;
}) {
  return (
    <GeoJSON
      data={provincesGeoJson}
      style={{
        color: "#113d0c",
        weight: 5,
        fillOpacity: 0,
      }}
    />
  );
}

function CoverageCircles({
  centroids,
  maxProvinceCount,
}: {
  centroids: Record<string, { lat: number; lng: number; count: number }>;
  maxProvinceCount: number;
}) {
  return (
    <>
      {Object.entries(centroids).map(([name, c]) => {
        if (c.count <= 0) return null;

        const ratio = maxProvinceCount > 0 ? c.count / maxProvinceCount : 0;
        const radiusMeters = 12000 + ratio * 55000;

        return (
          <Circle
            key={name}
            center={[c.lat, c.lng]}
            radius={radiusMeters}
            pathOptions={{
              color: "#0f6b43",
              weight: 1,
              fillColor: "#0f6b43",
              fillOpacity: 0.18,
            }}
          />
        );
      })}
    </>
  );
}

export default function CustomerMapCanvas({
  mode,
  customers,
  iranBorderGeoJson,
  provincesGeoJson,
  provinceCounts,
  provinceCentroids,
  maxProvinceCount,
  selectedProvince,
  onSelectProvince,
}: {
  mode: "markers" | "regions";
  customers: MapCustomer[];
  iranBorderGeoJson: any;
  provincesGeoJson: any;
  provinceCounts: Record<string, number>;
  provinceCentroids: Record<string, { lat: number; lng: number; count: number }>;
  maxProvinceCount: number;
  selectedProvince: string | null;
  onSelectProvince: (name: string | null) => void;
}) {
  return (
    <>
      <style>{markerPulseStyle}</style>
      <MapContainer
      center={IRAN_CENTER}
      zoom={5}
      minZoom={5}
      maxZoom={18}
      zoomControl={true}
      preferCanvas={true}
      maxBoundsViscosity={1.0}
      style={{ height: "100%", width: "100%" }}
    >
      <FitIranBounds />

      {/*
        لایه‌ی Voyager از CartoDB جزئیات بیشتری نسبت به تایل استاندارد OSM دارد:
        نام جاده‌ها، خیابان‌های فرعی و نقاط مهم شهری واضح‌تر دیده می‌شوند
        و از تایل‌های retina ({r}) برای وضوح بهتر روی صفحه‌های پرتراکم استفاده می‌کند.
      */}
      <TileLayer
        attribution="© OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        tileSize={256}
        zoomOffset={0}
        minZoom={5}
        maxZoom={18}
        maxNativeZoom={18}
        detectRetina={false}
        updateWhenIdle={true}
        updateWhenZooming={false}
        keepBuffer={1}
      />

      {iranBorderGeoJson && (
        <GeoJSON
          data={iranBorderGeoJson}
          style={{
            // خط دور ایران قرمز و نازک‌تر
            color: "#dc2626",
            weight: 2,
            fillOpacity: 0,
          }}
        />
      )}

      {mode === "markers" && provincesGeoJson && (
        <ProvinceBordersLayer provincesGeoJson={provincesGeoJson} />
      )}

      {mode === "markers" && (
        <CustomerMarkers customers={customers} />
      )}

      {mode === "regions" && provincesGeoJson && (
        <>
          <ProvincesLayer
            provincesGeoJson={provincesGeoJson}
            provinceCounts={provinceCounts}
            maxProvinceCount={maxProvinceCount}
            selectedProvince={selectedProvince}
            onSelectProvince={onSelectProvince}
          />
          <CoverageCircles centroids={provinceCentroids} maxProvinceCount={maxProvinceCount} />
        </>
      )}
    </MapContainer>
    </>
  );
}
