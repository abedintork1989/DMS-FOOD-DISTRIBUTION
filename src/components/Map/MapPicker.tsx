"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const IRAN_BOUNDS: [[number, number], [number, number]] = [
  [24, 43],
  [40.5, 63.5],
];

type LocationPoint = {
  latitude: number;
  longitude: number;
};

function MapMoveController({
  selected,
}: {
  selected: LocationPoint | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selected) return;

    map.flyTo(
      [selected.latitude, selected.longitude],
      Math.max(map.getZoom(), 16),
      { duration: 0.8 }
    );
  }, [map, selected?.latitude, selected?.longitude]);

  return null;
}

function MapControls({
  onChange,
}: {
  onChange: (p: LocationPoint) => void;
}) {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  async function searchAddress() {
    const value = query.trim();

    if (value.length < 2 || searching || locating) return;

    setSearching(true);
    setError("");

    try {
      const response = await fetch(
        `/api/geocode/search?q=${encodeURIComponent(value)}`,
        { cache: "no-store" }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "جستجوی آدرس ناموفق بود.");
      }

      const first = Array.isArray(result?.results)
        ? result.results[0]
        : null;

      if (!first) {
        setError("آدرس موردنظر پیدا نشد.");
        return;
      }

      const latitude = Number(first.latitude);
      const longitude = Number(first.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("مختصات نتیجه جستجو معتبر نیست.");
      }

      onChange({ latitude, longitude });
      map.flyTo([latitude, longitude], 16, { duration: 0.8 });
    } catch (error: any) {
      console.error("MAP SEARCH ERROR:", error);
      setError(error?.message || "خطا در جستجوی آدرس.");
    } finally {
      setSearching(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("مرورگر شما از موقعیت مکانی پشتیبانی نمی‌کند.");
      return;
    }

    setLocating(true);
    setError("");

    let bestAccuracy = Number.POSITIVE_INFINITY;
    let settled = false;
    let watchId: number | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }

      setLocating(false);
    };

    const handlePosition = (position: GeolocationPosition) => {
      const accuracy = Number(position.coords.accuracy);

      if (!Number.isFinite(accuracy)) {
        return;
      }

      // از اولین مختصات استفاده نمی‌کنیم؛ چند نمونه می‌گیریم
      // و دقیق‌ترین نمونه را انتخاب می‌کنیم.
      if (accuracy < bestAccuracy) {
        bestAccuracy = accuracy;

        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        onChange(point);

        map.flyTo(
          [point.latitude, point.longitude],
          Math.max(map.getZoom(), 17),
          { duration: 0.8 }
        );

        // دقت خوب: همان لحظه کار را تمام کن.
        if (accuracy <= 50) {
          finish();
          return;
        }

        // اگر دقت قابل قبول ولی نه عالی باشد، چند ثانیه فرصت
        // می‌دهیم نمونه دقیق‌تری از GPS/Location Service برسد.
        if (accuracy <= 150) {
          setError(
            `دقت فعلی حدود ${Math.round(accuracy)} متر است؛ در حال بهبود موقعیت...`
          );
        } else {
          setError(
            `دقت فعلی حدود ${Math.round(accuracy)} متر است؛ در حال پیدا کردن موقعیت دقیق‌تر...`
          );
        }
      }
    };

    const handleError = (geoError: GeolocationPositionError) => {
      const messages: Record<number, string> = {
        1: "دسترسی به موقعیت مکانی رد شد. اجازه Location را برای مرورگر فعال کنید.",
        2: "موقعیت فعلی پیدا نشد.",
        3: "دریافت موقعیت مکانی زمان‌بر شد. دوباره تلاش کنید.",
      };

      setError(
        messages[geoError.code] || "دریافت موقعیت فعلی ناموفق بود."
      );
      finish();
    };

    watchId = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );

    // بیشتر از 12 ثانیه منتظر نمی‌مانیم.
    window.setTimeout(() => {
      if (settled) return;

      if (Number.isFinite(bestAccuracy) && bestAccuracy <= 250) {
        setError(
          `بهترین دقت به‌دست‌آمده حدود ${Math.round(bestAccuracy)} متر است.`
        );
      } else {
        setError(
          "موقعیت دریافت شد اما دقت دستگاه پایین است. سرویس Location ویندوز/مرورگر را فعال کنید و دوباره تلاش کنید."
        );
      }

      finish();
    }, 12000);
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        left: 12,
        zIndex: 1000,
        direction: "rtl",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            flex: "1 1 420px",
            minWidth: 280,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                searchAddress();
              }
            }}
            placeholder="جستجوی آدرس، شهر، خیابان..."
            style={{
              flex: 1,
              minWidth: 0,
              height: 42,
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              padding: "0 12px",
              background: "#fff",
              outline: "none",
              fontFamily: "inherit",
              boxShadow: "0 4px 16px rgba(15,23,42,.12)",
            }}
          />

          <button
            type="button"
            onClick={searchAddress}
            disabled={
              searching || locating || query.trim().length < 2
            }
            style={{
              height: 42,
              padding: "0 15px",
              border: "none",
              borderRadius: 10,
              background:
                searching || locating || query.trim().length < 2
                  ? "#94a3b8"
                  : "#0f6b43",
              color: "#fff",
              cursor:
                searching || locating || query.trim().length < 2
                  ? "not-allowed"
                  : "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            {searching ? "در حال جستجو..." : "جستجو"}
          </button>
        </div>

        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={searching || locating}
          style={{
            height: 42,
            padding: "0 15px",
            border: "1px solid #cbd5e1",
            borderRadius: 10,
            background: "#fff",
            color: "#0f172a",
            cursor:
              searching || locating ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(15,23,42,.12)",
          }}
        >
          {locating ? "در حال دریافت..." : "موقعیت فعلی من"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: 8,
            display: "inline-block",
            padding: "8px 12px",
            borderRadius: 9,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontSize: 12,
            boxShadow: "0 4px 14px rgba(15,23,42,.08)",
            pointerEvents: "auto",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function LocationMarker({
  value,
  onChange,
}: {
  value: LocationPoint | null;
  onChange: (p: LocationPoint) => void;
}) {
  useMapEvents({
    click(e) {
      onChange({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      });
    },
  });

  if (!value) return null;

  return (
    <Marker
      position={[value.latitude, value.longitude]}
      icon={markerIcon}
      draggable
      eventHandlers={{
        dragend(e: any) {
          const p = e.target.getLatLng();

          onChange({
            latitude: p.lat,
            longitude: p.lng,
          });
        },
      }}
    />
  );
}

export default function LocationPickerMap({
  selected,
  onChange,
}: {
  selected: LocationPoint | null;
  onChange: (p: LocationPoint) => void;
}) {
  return (
    <MapContainer
      center={
        selected
          ? [selected.latitude, selected.longitude]
          : [32.4279, 53.688]
      }
      zoom={selected ? 16 : 5}
      minZoom={5}
      maxZoom={18}
      maxBounds={IRAN_BOUNDS}
      maxBoundsViscosity={1.0}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution="© OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapControls onChange={onChange} />
      <MapMoveController selected={selected} />
      <LocationMarker value={selected} onChange={onChange} />
    </MapContainer>
  );
}
