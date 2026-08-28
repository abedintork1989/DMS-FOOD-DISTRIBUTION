"use client";

import {
  MapContainer,
  TileLayer,
  Polygon,
  CircleMarker,
  Marker,
  Pane,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { featureCollection, union } from "@turf/turf";
import "leaflet/dist/leaflet.css";

type LatLng = [number, number];
type TerritoryGeometry = LatLng[] | LatLng[][] | LatLng[][][];

type Territory = {
  id: string;
  name?: string;
  province?: string;
  order?: number;
  geometry: TerritoryGeometry;
};

type Props = {
  drawing: boolean;
  draftPoints: LatLng[];
  territories: Territory[];
  countyBoundary: any;
  previewGeometry: TerritoryGeometry | null;
  onMapPoint: (point: LatLng) => void;
  onMovePoint: (index: number, point: LatLng) => void;
  focusTerritoryId?: string | null;
  hiddenTerritoryId?: string | null;
};

const TERRITORY_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#ca8a04",
  "#db2777",
];


const PROVINCE_CODES: Record<string, string> = {
  "مرکزی": "IR-00", "گیلان": "IR-01", "مازندران": "IR-02", "آذربایجان شرقی": "IR-03",
  "آذربایجان غربی": "IR-04", "کرمانشاه": "IR-05", "خوزستان": "IR-06", "فارس": "IR-07",
  "کرمان": "IR-08", "خراسان رضوی": "IR-09", "اصفهان": "IR-10", "سیستان و بلوچستان": "IR-11",
  "کردستان": "IR-12", "همدان": "IR-13", "چهارمحال و بختیاری": "IR-14", "لرستان": "IR-15",
  "ایلام": "IR-16", "کهگیلویه و بویراحمد": "IR-17", "بوشهر": "IR-18", "زنجان": "IR-19",
  "سمنان": "IR-20", "یزد": "IR-21", "هرمزگان": "IR-22", "تهران": "IR-23",
  "اردبیل": "IR-24", "قم": "IR-25", "قزوین": "IR-26", "گلستان": "IR-27",
  "خراسان شمالی": "IR-28", "خراسان جنوبی": "IR-29", "البرز": "IR-30",
};

type AdminResult = {
  provinceCode: string;
  counties: any[];
  province: any | null;
};

const adminCache = new Map<string, Promise<AdminResult>>();

function normalizeProvinceName(value: any): string {
  return String(value ?? "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getProvinceCodes(names: string[] = []): string[] {
  const result = new Set<string>();
  for (const name of names) {
    const normalized = normalizeProvinceName(name);
    const code = PROVINCE_CODES[normalized];
    if (code) result.add(code);
  }
  return [...result];
}

function loadAdministrativeProvince(provinceCode: string): Promise<AdminResult> {
  const cached = adminCache.get(provinceCode);
  if (cached) return cached;

  const promise = fetch(`/data/counties/${provinceCode}/${provinceCode}.all.geojson`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const features = (Array.isArray(json?.features) ? json.features : [])
        .filter((feature: any) =>
          feature?.geometry?.type === "Polygon" ||
          feature?.geometry?.type === "MultiPolygon"
        );

      let province = null;
      if (features.length) {
        try {
          const merged = (union as any)(featureCollection(features as any) as any);
          province = merged?.geometry ? merged.geometry : null;
        } catch (error) {
          console.warn("ADMIN PROVINCE UNION ERROR", provinceCode, error);
        }
      }

      return {
        provinceCode,
        counties: features.map((feature: any) => feature.geometry),
        province,
      };
    })
    .catch((error) => {
      console.warn("ADMIN BOUNDARY LOAD ERROR", provinceCode, error);
      return { provinceCode, counties: [], province: null };
    });

  adminCache.set(provinceCode, promise);
  return promise;
}

function useAutomaticAdministrativeBorders(activeProvinceNames: string[] = []) {
  const provinceCodes = useMemo(
    () => getProvinceCodes(activeProvinceNames),
    [activeProvinceNames]
  );
  const [data, setData] = useState<AdminResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!provinceCodes.length) {
      setData([]);
      return;
    }

    Promise.all(provinceCodes.map(loadAdministrativeProvince)).then((results) => {
      if (!cancelled) setData(results);
    });

    return () => {
      cancelled = true;
    };
  }, [provinceCodes]);

  return data;
}

function AutomaticAdministrativeBorders({ activeProvinceNames }: { activeProvinceNames?: string[] }) {
  const data = useAutomaticAdministrativeBorders(activeProvinceNames ?? []);

  return (
    <>
      {data.flatMap((result) =>
        result.counties.map((geometry, index) => (
          <Polygon
            key={`auto-county-${result.provinceCode}-${index}`}
            positions={geoJsonToLeafletPolygons(geometry) as any}
            pathOptions={{
              color: "#2563eb",
              weight: 4,
              dashArray: "7 7",
              fillOpacity: 0,
              interactive: false,
            }}
          />
        ))
      )}

      {data.map((result) =>
        result.province ? (
          <Polygon
            key={`auto-province-${result.provinceCode}`}
            positions={geoJsonToLeafletPolygons(result.province) as any}
            pathOptions={{
              color: "#dc2626",
              weight: 4,
              fillOpacity: 0,
              interactive: false,
            }}
          />
        ) : null
      )}
    </>
  );
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

function sanitizeRing(ring: any): LatLng[] {
  if (!Array.isArray(ring)) return [];

  return ring
    .filter(isValidLatLng)
    .map(
      (p) =>
        [Number(p[0]), Number(p[1])] as LatLng
    );
}

function extractGeometry(input: any): any | null {
  if (!input) return null;

  let geometry = input;

  if (typeof geometry === "string") {
    try {
      geometry = JSON.parse(geometry);
    } catch (error) {
      console.error("GEOMETRY PARSE ERROR", error);
      return null;
    }
  }

  if (geometry?.type === "FeatureCollection") {
    geometry =
      geometry.features?.[0]?.geometry ?? null;
  }

  if (geometry?.type === "Feature") {
    geometry = geometry.geometry;
  }

  if (!geometry?.type || !geometry?.coordinates) {
    return null;
  }

  if (
    geometry.type !== "Polygon" &&
    geometry.type !== "MultiPolygon"
  ) {
    return null;
  }

  return geometry;
}

function ringToLatLngs(ring: any[]): LatLng[] {
  if (!Array.isArray(ring)) return [];

  return ring
    .filter(
      (p) =>
        Array.isArray(p) &&
        Number.isFinite(Number(p[0])) &&
        Number.isFinite(Number(p[1]))
    )
    .map(
      (p: any) =>
        [Number(p[1]), Number(p[0])] as LatLng
    );
}

/**
 * خروجی همیشه آرایه‌ای از Polygonهاست:
 *
 * geometry قدیمی:
 *   [ [lat,lng], ... ]
 *      -> [ [ ring ] ]
 *
 * Polygon:
 *   [ ring, hole ]
 *      -> [ [ ring, hole ] ]
 *
 * MultiPolygon:
 *   [ [ring...], [ring...] ]
 *      -> [ polygon1, polygon2, ... ]
 *
 * این ساختار باعث می‌شود قطعات MultiPolygon به هم
 * وصل یا به‌اشتباه hole تفسیر نشوند.
 */
function geometryToLeafletPolygons(
  geometry: TerritoryGeometry
): LatLng[][][] {
  if (!Array.isArray(geometry) || geometry.length === 0) {
    return [];
  }

  const first = geometry[0] as any;

  // geometry قدیمی: [ [lat,lng], ... ]
  if (isValidLatLng(first)) {
    const ring = sanitizeRing(geometry);

    return ring.length >= 3 ? [[ring]] : [];
  }

  // Polygon: [ ring, hole, ... ]
  if (
    Array.isArray(first) &&
    isValidLatLng(first[0])
  ) {
    const rings = (geometry as LatLng[][])
      .map(sanitizeRing)
      .filter((ring) => ring.length >= 3);

    return rings.length ? [rings] : [];
  }

  // MultiPolygon: [ polygon, polygon, ... ]
  if (
    Array.isArray(first) &&
    Array.isArray(first[0]) &&
    isValidLatLng(first[0][0])
  ) {
    return (geometry as LatLng[][][])
      .map((polygon) =>
        polygon
          .map(sanitizeRing)
          .filter((ring) => ring.length >= 3)
      )
      .filter((polygon) => polygon.length > 0);
  }

  return [];
}

function geoJsonToLeafletPolygons(geometry: any): LatLng[][][] {
  if (!geometry?.type || !geometry?.coordinates) return [];
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates
      .map((ring: any) => ringToLatLngs(ring))
      .filter((ring: LatLng[]) => ring.length >= 3);
    return rings.length ? [rings] : [];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((polygon: any) =>
        polygon
          .map((ring: any) => ringToLatLngs(ring))
          .filter((ring: LatLng[]) => ring.length >= 3)
      )
      .filter((polygon: LatLng[][]) => polygon.length > 0);
  }
  return [];
}

function normalizeBoundaries(
  countyBoundary: any
): any[] {
  if (!countyBoundary) return [];

  const list = Array.isArray(countyBoundary)
    ? countyBoundary
    : [countyBoundary];

  return list
    .map(extractGeometry)
    .filter(Boolean);
}

function MapController({
  boundaries,
}: {
  boundaries: any[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!boundaries.length) return;

    let timeoutId:
      | ReturnType<typeof setTimeout>
      | undefined;

    try {
      const geoJsonLayer = L.geoJSON(
        boundaries.map((geometry) => ({
          type: "Feature",
          properties: {},
          geometry,
        })) as any
      );

      const bounds = geoJsonLayer.getBounds();

      if (!bounds.isValid()) return;

      timeoutId = setTimeout(() => {
        map.invalidateSize();

        map.fitBounds(bounds, {
          padding: [50, 50],
          animate: true,
        });
      }, 300);
    } catch (error) {
      console.error(
        "MAP FIT BOUNDS ERROR",
        error
      );
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [boundaries, map]);

  return null;
}

function TerritoryFocusController({
  territories,
  focusTerritoryId,
}: {
  territories: Territory[];
  focusTerritoryId?: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusTerritoryId) return;

    const territory = territories.find(
      (item) => item.id === focusTerritoryId
    );

    if (!territory) return;

    try {
      const polygons = geometryToLeafletPolygons(territory.geometry);
      if (!polygons.length) return;

      const layers = polygons.map((positions) =>
        L.polygon(positions as any)
      );
      const group = L.featureGroup(layers);
      const bounds = group.getBounds();

      if (!bounds.isValid()) return;

      map.fitBounds(bounds, {
        padding: [55, 55],
        maxZoom: 14,
        animate: true,
      });
    } catch (error) {
      console.error("TERRITORY FOCUS ERROR", error);
    }
  }, [focusTerritoryId, territories, map]);

  return null;
}

function MapClickHandler({
  drawing,
  countyBoundary,
  onMapPoint,
}: {
  drawing: boolean;
  countyBoundary: any;
  onMapPoint: (p: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (!drawing) return;

      const latLng: LatLng = [
        e.latlng.lat,
        e.latlng.lng,
      ];

      if (!isValidLatLng(latLng)) return;

      // عمداً اجازه می‌دهیم کاربر خارج از شهرستان هم نقطه بگذارد.
      // هندسه نهایی در Manager ابتدا با مرز شهرستان clip می‌شود و
      // سپس قسمت‌های همپوشان با مناطق همان شهرستان حذف می‌شوند.
      onMapPoint(latLng);
    },
  });

  return null;
}

function DraftPointDrag({
  point,
  index,
  countyBoundary,
  onMovePoint,
}: {
  point: LatLng;
  index: number;
  countyBoundary: any;
  onMovePoint: (
    index: number,
    point: LatLng
  ) => void;
}) {
  const map = useMap();

  return (
    <CircleMarker
      center={point}
      radius={6}
      eventHandlers={{
        mousedown(e) {
          const marker =
            e.target as L.CircleMarker;
          const mapInstance = map;
          const originalEvent =
            e.originalEvent as MouseEvent;

          L.DomEvent.stopPropagation(
            originalEvent
          );
          L.DomEvent.preventDefault(
            originalEvent
          );

          const move = (event: L.LeafletMouseEvent) => {
            const latlng = event.latlng;

            if (
              !Number.isFinite(latlng.lat) ||
              !Number.isFinite(latlng.lng)
            ) {
              return;
            }

            // نقطه درگ‌شده هم می‌تواند خارج از شهرستان قرار بگیرد.
            // هندسه نهایی هنگام preview/save با مرز شهرستان clip می‌شود.
            marker.setLatLng(latlng);
          };

          const end = () => {
            const pos =
              marker.getLatLng();

            if (
              Number.isFinite(pos.lat) &&
              Number.isFinite(pos.lng)
            ) {
              onMovePoint(index, [
                pos.lat,
                pos.lng,
              ]);
            }

            mapInstance.off(
              "mousemove",
              move as L.LeafletEventHandlerFn
            );
            mapInstance.off(
              "mouseup",
              end as L.LeafletEventHandlerFn
            );
            mapInstance.dragging.enable();
          };

          mapInstance.dragging.disable();
          mapInstance.on(
            "mousemove",
            move as L.LeafletEventHandlerFn
          );
          mapInstance.on(
            "mouseup",
            end as L.LeafletEventHandlerFn
          );
        },
      }}
      pathOptions={{
        color: "#16a34a",
        fillColor: "#16a34a",
        fillOpacity: 1,
      }}
    />
  );
}

function territoryColor(
  index: number
): string {
  return TERRITORY_COLORS[
    index % TERRITORY_COLORS.length
  ];
}

function getLabelPoint(
  geometry: TerritoryGeometry
): LatLng | null {
  const polygons = geometryToLeafletPolygons(geometry);

  if (!polygons.length) return null;

  // برای MultiPolygon، بزرگ‌ترین قطعه را برای محل نوشته انتخاب می‌کنیم.
  // این باعث می‌شود برچسب هر منطقه روی همان منطقه قرار بگیرد و همه‌ی
  // منطقه‌ها محل برچسب مستقل داشته باشند.
  let bestRing: LatLng[] | null = null;
  let bestArea = -1;

  for (const polygon of polygons) {
    const outer = polygon[0];
    if (!outer || outer.length < 3) continue;

    let area = 0;
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i];
      const b = outer[(i + 1) % outer.length];
      area += a[0] * b[1] - b[0] * a[1];
    }

    area = Math.abs(area);

    if (area > bestArea) {
      bestArea = area;
      bestRing = outer;
    }
  }

  if (!bestRing) return null;

  // centroid تقریبی حلقه؛ برای محدوده‌های نامنظم از centerِ bounds بهتر است.
  let signedArea = 0;
  let latSum = 0;
  let lngSum = 0;

  for (let i = 0; i < bestRing.length; i++) {
    const [lat1, lng1] = bestRing[i];
    const [lat2, lng2] = bestRing[(i + 1) % bestRing.length];
    const cross = lat1 * lng2 - lat2 * lng1;
    signedArea += cross;
    latSum += (lat1 + lat2) * cross;
    lngSum += (lng1 + lng2) * cross;
  }

  if (Math.abs(signedArea) > 1e-12) {
    const factor = 1 / (3 * signedArea);
    const center: LatLng = [latSum * factor, lngSum * factor];

    if (isValidLatLng(center)) return center;
  }

  // fallback امن برای هندسه‌های خیلی نامنظم یا کوچک
  try {
    const layer = L.polygon(bestRing as any);
    const center = layer.getBounds().getCenter();
    return [center.lat, center.lng];
  } catch {
    return bestRing[0] ?? null;
  }
}

function TerritoryLabels({
  territories,
  hiddenTerritoryId,
}: {
  territories: Territory[];
  hiddenTerritoryId?: string | null;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const handleZoom = () => setZoom(map.getZoom());

    map.on("zoomend", handleZoom);
    return () => {
      map.off("zoomend", handleZoom);
    };
  }, [map]);

  // متن عمداً کوچک است و با zoom نرم تغییر می‌کند.
  const fontSize = Math.max(20, Math.min(48, 20 + (zoom - 8) * 2.4));

  return (
    <Pane name="territoryLabels" style={{ zIndex: 1000, pointerEvents: "none" }}>
      {territories.map((item, index) => {
        if (item.id === hiddenTerritoryId) return null;

        const position = getLabelPoint(item.geometry);
        if (!position) return null;

        const color = territoryColor(
          Math.max(0, Number(item.order ?? index + 1) - 1)
        );
        const label = item.name?.trim() || `منطقه ${item.order ?? index + 1}`;

        const icon = L.divIcon({
          className: "territory-name-label",
          html: `
            <span style="
              display:block;
              width:max-content;
              color:${color};
              font-size:${fontSize}px;
              font-weight:800;
              line-height:1;
              white-space:nowrap;
              direction:rtl;
              text-align:center;
              transform:translate(-50%,-50%);
              -webkit-text-stroke:1.2px rgba(255,255,255,.98);
              text-shadow:0 0 2px rgba(255,255,255,.98),0 0 5px rgba(255,255,255,.95);
              pointer-events:none;
              user-select:none;
            ">${label}</span>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        return (
          <Marker
            key={`territory-label-${item.id}`}
            position={position}
            icon={icon}
            interactive={false}
            zIndexOffset={10000 + index}
          />
        );
      })}
    </Pane>
  );
}

export default function TerritoryMapCanvas({
  drawing,
  draftPoints,
  territories,
  countyBoundary,
  previewGeometry,
  onMapPoint,
  onMovePoint,
  focusTerritoryId,
  hiddenTerritoryId,
}: Props) {
  const boundaryGeometries = useMemo(
    () =>
      normalizeBoundaries(
        countyBoundary
      ),
    [countyBoundary]
  );

  const boundaryPositionsList =
    useMemo(
      () =>
        boundaryGeometries
          .map((geometry) => {
            const extracted =
              extractGeometry(geometry);

            if (!extracted) return null;

            if (
              extracted.type ===
              "Polygon"
            ) {
              return extracted.coordinates.map(
                (ring: any) =>
                  ringToLatLngs(ring)
              );
            }

            return extracted.coordinates.map(
              (polygon: any) =>
                polygon.map((ring: any) =>
                  ringToLatLngs(ring)
                )
            );
          })
          .filter(
            (
              p
            ): p is LatLng[][] | LatLng[][][] =>
              !!p
          ),
      [boundaryGeometries]
    );

  const activeProvinceNames = useMemo(
    () =>
      Array.from(
        new Set(
          territories
            .map((item) => normalizeProvinceName(item.province))
            .filter(Boolean)
        )
      ),
    [territories]
  );

  const previewPolygons = useMemo(
    () =>
      previewGeometry
        ? geometryToLeafletPolygons(
            previewGeometry
          )
        : [],
    [previewGeometry]
  );

  return (
    <MapContainer
      center={[35.6892, 51.389]}
      zoom={8}
      style={{
        width: "100%",
        height: "100%",
      }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      <AutomaticAdministrativeBorders activeProvinceNames={activeProvinceNames} />

      <MapController
        boundaries={boundaryGeometries}
      />

      <TerritoryFocusController
        territories={territories}
        focusTerritoryId={focusTerritoryId}
      />

      <MapClickHandler
        drawing={drawing}
        countyBoundary={countyBoundary}
        onMapPoint={onMapPoint}
      />

      {boundaryPositionsList.map(
        (positions, index) => (
          <Polygon
            key={`county-boundary-${index}`}
            positions={positions as any}
            pathOptions={{
              color: "#2563eb",
              weight: 4,
              fillColor: "#3b82f6",
              fillOpacity: 0.15,
            }}
          />
        )
      )}

      {territories.map(
        (item, index) => {
          if (item.id === hiddenTerritoryId) return null;

          const polygons =
            geometryToLeafletPolygons(
              item.geometry
            );

          const color =
            territoryColor(
              Math.max(0, Number(item.order ?? index + 1) - 1)
            );

          return polygons.map(
            (positions, polygonIndex) => (
              <Polygon
                key={`${item.id}-${polygonIndex}`}
                positions={positions as any}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.25,
                  weight: 2,
                }}
              />
            )
          );
        }
      )}

      <TerritoryLabels
        territories={territories}
        hiddenTerritoryId={hiddenTerritoryId}
      />

      {drawing &&
        draftPoints.map(
          (point, index) => (
            <DraftPointDrag
              key={`draft-point-${index}`}
              point={point}
              index={index}
              countyBoundary={countyBoundary}
              onMovePoint={onMovePoint}
            />
          )
        )}

      {drawing &&
        previewPolygons.length > 0 &&
        previewPolygons.map(
          (positions, index) => (
            <Polygon
              key={`preview-${index}`}
              positions={positions as any}
              pathOptions={{
                color: "#16a34a",
                dashArray: "8 6",
                fillColor: "#16a34a",
                fillOpacity: 0.2,
              }}
            />
          )
        )}
    </MapContainer>
  );
}
