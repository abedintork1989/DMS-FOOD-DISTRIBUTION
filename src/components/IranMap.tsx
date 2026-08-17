"use client";

import { useEffect, useRef } from "react";

interface IranMapProps {
  height?: string;
  width?: string;
  zoom?: number;
  center?: [number, number];
  onProvinceClick?: (provinceName: string) => void;
}

export default function IranMap({
  height = "600px",
  width = "100%",
  zoom = 5,
  center = [32.6546, 51.9111],
  onProvinceClick,
}: IranMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapContainer.current) return;

      try {
        const leafletModule = await import("leaflet");
        if (cancelled || !mapContainer.current) return;

        const L = leafletModule.default;

        // اگر نقشه قبلاً ایجاد شده، آن را تخریب کن
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        // نقشه را ایجاد کن
        const map = L.map(mapContainer.current).setView(center, zoom);

        // لایه OpenStreetMap
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        // دانلود و اضافه‌کردن داده‌های استان‌های ایران
        try {
          const response = await fetch(
            "https://raw.githubusercontent.com/sepandhaghighi/iran-geo/master/iran.json"
          );

          if (!response.ok) {
            throw new Error("نتوانستیم نقشه ایران را بارگذاری کنیم");
          }

          const iranGeoData = await response.json();

          // استایل لایه‌ها
          const geoJsonStyle = {
            fillColor: "#d4d4d8", // رنگ طوسی برای استان‌ها
            weight: 2.5,
            opacity: 0.8,
            color: "#52525b", // رنگ مرز تیره‌تر
            dashArray: "0",
            fillOpacity: 0.5,
          };

          const hoverStyle = {
            fillColor: "#a3a3a8",
            weight: 3,
            opacity: 1,
            color: "#18181b",
            fillOpacity: 0.7,
          };

          // اضافه‌کردن GeoJSON
          const geoJsonLayer = L.geoJSON(iranGeoData, {
            style: geoJsonStyle,
            onEachFeature: (feature, layer) => {
              const provinceName =
                feature.properties?.name || "ناشناخته";

              // برای دسترسی به setStyle و bringToFront، لایه را به نوع Path تبدیل می‌کنیم.
              const provinceLayer = layer as L.Path;

              // افزودن popup
              provinceLayer.bindPopup(`
                <div style="text-align: right; direction: rtl;">
                  <strong>${provinceName}</strong><br/>
                  <small>کلیک برای اطلاعات بیشتر</small>
                </div>
              `);

              // رویدادهای ماوس
              provinceLayer.on("mouseover", () => {
                provinceLayer.setStyle(hoverStyle);
                provinceLayer.bringToFront();
              });

              provinceLayer.on("mouseout", () => {
                provinceLayer.setStyle(geoJsonStyle);
              });

              provinceLayer.on("click", () => {
                onProvinceClick?.(provinceName);
              });
            },
          }).addTo(map);

          // تطابق نقشه با محدوده ایران
          const bounds = geoJsonLayer.getBounds();

          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
          }
        } catch (geoError) {
          console.warn("خطا در بارگذاری داده‌های GeoJSON:", geoError);

          // اگر GeoJSON بارگذاری نشد، یک دایره ساده در تهران اضافه کن
          L.circle(center, {
            radius: 500000,
            color: "#ef4444",
          }).addTo(map);
        }

        mapRef.current = map;
      } catch (error) {
        console.error("خطا در ایجاد نقشه:", error);
      }
    }

    // نقشه فقط در سمت کلاینت ساخته می‌شود.
    initMap();

    return () => {
      cancelled = true;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [center, zoom, onProvinceClick]);

  return (
    <div
      ref={mapContainer}
      style={{
        width,
        height,
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      }}
    />
  );
}
