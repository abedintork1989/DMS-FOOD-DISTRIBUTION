"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  MapContainer,
  TileLayer,
  Polygon,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import {
  polygon,
  intersect,
  point,
  booleanPointInPolygon,
} from "@turf/turf";


type LatLng = [number, number];


type Props = {
  county: any;
  territory: any;
  saving: boolean;
  onClose: () => void;
  onSave: (geometry: any) => void;
};


type CountyGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: any;
};


const DEFAULT_CENTER: LatLng = [
  35.6892,
  51.389,
];



/* -------------------------------------------------------------------------- */
/* Map Controller                                                             */
/* -------------------------------------------------------------------------- */

function MapController({
  center,
  bounds,
}: {
  center: LatLng;
  bounds?: LatLng[] | null;
}) {

  const map = useMap();


  useEffect(() => {

    if (
      bounds &&
      bounds.length > 2
    ) {

      map.fitBounds(
        bounds as LatLng[],
        {
          padding: [60, 60],
          maxZoom: 15,
        }
      );

      return;
    }


    map.setView(
      center,
      13
    );

  }, [
    map,
    center,
    bounds,
  ]);


  return null;
}



/* -------------------------------------------------------------------------- */
/* Click Handler                                                              */
/* -------------------------------------------------------------------------- */

function ClickHandler({
  onClick,
  countyFeature,
}: {
  onClick: (point: LatLng) => void;
  countyFeature: any;
}) {


  useMapEvents({

    click(event) {

      const clickedPoint: LatLng = [
        event.latlng.lat,
        event.latlng.lng,
      ];


      /*
       * اگر مرز شهرستان داریم،
       * کلیک باید حتماً داخل همان شهرستان باشد.
       */

      if (countyFeature) {

        try {

          const inside =
            booleanPointInPolygon(
              point([
                clickedPoint[1],
                clickedPoint[0],
              ]),
              countyFeature
            );


          if (!inside) {

            return;

          }

        } catch {

          return;

        }

      }


      onClick(clickedPoint);

    },

  });


  return null;
}



/* -------------------------------------------------------------------------- */
/* استخراج Geometry شهرستان                                                       */
/* -------------------------------------------------------------------------- */

function getCountyGeometry(
  county: any
): CountyGeometry | null {


  const geometry =
    county?.geometry?.geometry ||
    county?.geometry?.geojson ||
    county?.geometry;


  if (!geometry) {
    return null;
  }


  // پشتیبانی از GeoJSON Feature
  const normalizedGeometry =
    geometry.type === "Feature"
      ? geometry.geometry
      : geometry;


  if (!normalizedGeometry) {
    return null;
  }


  if (
    normalizedGeometry.type !== "Polygon" &&
    normalizedGeometry.type !== "MultiPolygon"
  ) {

    return null;

  }


  if (!geometry.coordinates) {
    return null;
  }


  return normalizedGeometry;

}



/* -------------------------------------------------------------------------- */
/* تبدیل Geometry به Feature Turf                                             */
/* -------------------------------------------------------------------------- */

function geometryToFeature(
  geometry: CountyGeometry
) {


  return {

    type: "Feature",

    properties: {},

    geometry,

  };

}



/* -------------------------------------------------------------------------- */
/* استخراج نقاط برای نمایش Polygon                                            */
/* -------------------------------------------------------------------------- */

function getCountyDisplayPolygon(
  geometry: CountyGeometry | null
): LatLng[] | null {


  if (!geometry) {
    return null;
  }


  if (
    geometry.type === "Polygon"
  ) {

    const ring =
      geometry.coordinates?.[0];


    if (
      !Array.isArray(ring) ||
      ring.length < 3
    ) {

      return null;

    }


    return ring.map(
      (p: number[]) =>
        [
          Number(p[1]),
          Number(p[0]),
        ] as LatLng
    );

  }



  /*
   * برای MultiPolygon،
   * بزرگ‌ترین/اولین Polygon اصلی را
   * برای خط نمایش انتخاب می‌کنیم.
   *
   * خود Feature همچنان MultiPolygon می‌ماند
   * و برای محدودیت کلیک استفاده می‌شود.
   */

  if (
    geometry.type === "MultiPolygon"
  ) {

    const polygons =
      geometry.coordinates;


    if (
      !Array.isArray(polygons) ||
      polygons.length === 0
    ) {

      return null;

    }


    let largestRing: any[] = [];


    for (
      const polygonItem of polygons
    ) {

      const ring =
        polygonItem?.[0];


      if (
        Array.isArray(ring) &&
        ring.length > largestRing.length
      ) {

        largestRing = ring;

      }

    }


    if (
      largestRing.length < 3
    ) {

      return null;

    }


    return largestRing.map(
      (p: number[]) =>
        [
          Number(p[1]),
          Number(p[0]),
        ] as LatLng
    );

  }


  return null;

}



/* -------------------------------------------------------------------------- */
/* مرکز شهرستان                                                                   */
/* -------------------------------------------------------------------------- */

function getCenter(
  points: LatLng[]
): LatLng {


  if (!points.length) {

    return DEFAULT_CENTER;

  }


  let lat = 0;
  let lng = 0;


  for (
    const point of points
  ) {

    lat += point[0];
    lng += point[1];

  }


  return [
    lat / points.length,
    lng / points.length,
  ];

}



/* -------------------------------------------------------------------------- */
/* استخراج مرکز از Geometry                                                   */
/* -------------------------------------------------------------------------- */

function getGeometryCenter(
  geometry: CountyGeometry | null
): LatLng {


  const polygon =
    getCountyDisplayPolygon(
      geometry
    );


  if (!polygon) {

    return DEFAULT_CENTER;

  }


  return getCenter(
    polygon
  );

}



/* -------------------------------------------------------------------------- */
/* دریافت Geometry شهرستان از Nominatim                                            */
/* -------------------------------------------------------------------------- */

async function fetchCountyFromNominatim(
  county: any
): Promise<CountyGeometry | null> {


  const countyName =
    String(
      county?.name || ""
    ).trim();


  if (!countyName) {
    return null;
  }



  /*
   * برای کاهش اشتباه در شهرستانهای هم‌نام،
   * از والدها هم استفاده می‌کنیم.
   */

  const parentName =
    String(
      county?.parent?.name ||
      county?.county?.name ||
      ""
    ).trim();



  const queryParts = [
    countyName,
    parentName,
    "Iran",
  ].filter(Boolean);



  const query =
    encodeURIComponent(
      queryParts.join(", ")
    );



  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?format=jsonv2` +
    `&polygon_geojson=1` +
    `&limit=10` +
    `&countrycodes=ir` +
    `&q=${query}`;



  const response =
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );



  if (!response.ok) {

    throw new Error(
      `Nominatim ${response.status}`
    );

  }



  const results =
    await response.json();



  if (
    !Array.isArray(results) ||
    results.length === 0
  ) {

    return null;

  }



  /*
   * اولویت با نتیجه‌ای است که
   * Geometry واقعی داشته باشد.
   */

  for (
    const result of results
  ) {

    const geometry =
      result?.geojson;


    if (!geometry) {
      continue;
    }


    if (
      geometry.type === "Polygon" ||
      geometry.type === "MultiPolygon"
    ) {

      return geometry;

    }

  }



  return null;

}



/* -------------------------------------------------------------------------- */
/* دریافت Geometry شهرستان از Overpass به عنوان پشتیبان                           */
/* -------------------------------------------------------------------------- */

async function fetchCountyFromOverpass(
  county: any
): Promise<CountyGeometry | null> {


  const countyName =
    String(
      county?.name || ""
    ).trim();


  if (!countyName) {
    return null;
  }


  const safeName =
    countyName
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');



  const query = `

[out:json][timeout:90];

area["ISO3166-1"="IR"]->.iran;

relation
  ["boundary"="administrative"]
  ["name"="${safeName}"]
  (area.iran);

out geom;

`;



  const endpoints = [

    "https://overpass-api.de/api/interpreter",

    "https://overpass.kumi.systems/api/interpreter",

    "https://overpass.private.coffee/api/interpreter",

  ];



  for (
    const endpoint of endpoints
  ) {


    try {


      const response =
        await fetch(
          `${endpoint}?data=${encodeURIComponent(query)}`,
          {
            method: "GET",
            headers: {
              Accept:
                "application/json",
            },
            cache:
              "no-store",
          }
        );



      if (!response.ok) {
        continue;
      }



      const data =
        await response.json();



      const relation =
        data?.elements?.find(
          (item: any) =>
            Array.isArray(
              item?.members
            ) &&
            item.members.some(
              (member: any) =>
                Array.isArray(
                  member?.geometry
                )
            )
        );



      if (!relation) {
        continue;
      }



      const rings: any[] = [];



      for (
        const member of
        relation.members || []
      ) {


        if (
          !Array.isArray(
            member.geometry
          )
        ) {

          continue;

        }



        const ring =
          member.geometry.map(
            (p: any) => [
              Number(p.lon),
              Number(p.lat),
            ]
          );



        if (
          ring.length >= 4
        ) {

          const first =
            ring[0];

          const last =
            ring[ring.length - 1];


          if (
            first[0] !== last[0] ||
            first[1] !== last[1]
          ) {

            ring.push(first);

          }


          rings.push(ring);

        }

      }



      if (
        rings.length === 0
      ) {

        continue;

      }



      /*
       * اگر فقط یک Ring داشته باشیم Polygon.
       * در غیر این صورت MultiPolygon.
       */

      if (
        rings.length === 1
      ) {

        return {

          type: "Polygon",

          coordinates: [
            rings[0],
          ],

        };

      }



      return {

        type: "MultiPolygon",

        coordinates:
          rings.map(
            (ring) => [ring]
          ),

      };



    } catch (
      error
    ) {

      console.warn(
        "OVERPASS COUNTY BOUNDARY ERROR:",
        endpoint,
        error
      );

    }

  }



  return null;

}



/* -------------------------------------------------------------------------- */
/* دریافت مرز شهرستان                                                             */
/* -------------------------------------------------------------------------- */

async function fetchCountyGeometry(
  county: any
): Promise<CountyGeometry | null> {


  /*
   * مرحله اول:
   * Geometry موجود در خود Supabase
   */

  const databaseGeometry =
    getCountyGeometry(county);


  if (
    databaseGeometry
  ) {

    return databaseGeometry;

  }



  /*
   * مرحله دوم:
   * Nominatim
   */

  try {

    const geometry =
      await fetchCountyFromNominatim(
        county
      );


    if (geometry) {

      return geometry;

    }

  } catch (
    error
  ) {

    console.warn(
      "NOMINATIM COUNTY BOUNDARY ERROR:",
      error
    );

  }



  /*
   * مرحله سوم:
   * Overpass
   */

  try {

    const geometry =
      await fetchCountyFromOverpass(
        county
      );


    if (geometry) {

      return geometry;

    }

  } catch (
    error
  ) {

    console.warn(
      "OVERPASS COUNTY BOUNDARY ERROR:",
      error
    );

  }



  return null;

}



/* -------------------------------------------------------------------------- */
/* برش محدوده داخل شهرستان                                                        */
/* -------------------------------------------------------------------------- */

function clipBoundaryToCounty(
  boundary: LatLng[],
  countyGeometry: CountyGeometry | null
): LatLng[] {


  if (
    !countyGeometry ||
    boundary.length < 4
  ) {

    return boundary;

  }



  try {


    const userFeature =
      polygon([
        boundary.map(
          ([lat, lng]) =>
            [lng, lat]
        ),
      ]);



    const countyFeature =
      geometryToFeature(
        countyGeometry
      );



    const result =
      intersect({
        type: "FeatureCollection",
        features: [
          userFeature,
          countyFeature as any,
        ],
      } as any);



    if (!result) {

      return [];

    }



    const resultGeometry =
      result.geometry;



    if (
      resultGeometry.type ===
      "Polygon"
    ) {

      const ring =
        resultGeometry
          .coordinates?.[0];


      if (
        !Array.isArray(ring)
      ) {

        return [];

      }


      return ring.map(
        (p: number[]) =>
          [
            p[1],
            p[0],
          ] as LatLng
      );

    }



    /*
     * اگر Intersection چندبخشی باشد،
     * بزرگ‌ترین Polygon را برای
     * نمایش/ذخیره انتخاب می‌کنیم.
     */

    if (
      resultGeometry.type ===
      "MultiPolygon"
    ) {

      const polygons =
        resultGeometry.coordinates;


      let best: any[] = [];


      for (
        const polygonItem of
        polygons
      ) {

        const ring =
          polygonItem?.[0];


        if (
          Array.isArray(ring) &&
          ring.length > best.length
        ) {

          best = ring;

        }

      }



      if (
        best.length >= 4
      ) {

        return best.map(
          (p: number[]) =>
            [
              p[1],
              p[0],
            ] as LatLng
        );

      }

    }



  } catch (
    error
  ) {

    console.error(
      "CLIP BOUNDARY ERROR:",
      error
    );

  }



  return [];

}



/* -------------------------------------------------------------------------- */
/* محدوده هوشمند اولیه                                                        */
/* -------------------------------------------------------------------------- */

function hull(
  points: LatLng[]
): LatLng[] {


  if (
    points.length < 3
  ) {

    return [];

  }



  const pts =
    [...points].sort(
      (a, b) =>
        a[1] === b[1]
          ? a[0] - b[0]
          : a[1] - b[1]
    );



  const cross = (
    o: LatLng,
    a: LatLng,
    b: LatLng
  ) =>

    (a[1] - o[1]) *
      (b[0] - o[0]) -

    (a[0] - o[0]) *
      (b[1] - o[1]);



  const lower: LatLng[] = [];



  for (
    const p of pts
  ) {

    while (
      lower.length >= 2 &&
      cross(
        lower[
          lower.length - 2
        ],
        lower[
          lower.length - 1
        ],
        p
      ) <= 0
    ) {

      lower.pop();

    }


    lower.push(p);

  }



  const upper: LatLng[] = [];



  for (
    const p of [...pts].reverse()
  ) {

    while (
      upper.length >= 2 &&
      cross(
        upper[
          upper.length - 2
        ],
        upper[
          upper.length - 1
        ],
        p
      ) <= 0
    ) {

      upper.pop();

    }


    upper.push(p);

  }



  upper.pop();
  lower.pop();



  const result = [
    ...lower,
    ...upper,
  ];



  if (
    result.length > 0
  ) {

    result.push(
      result[0]
    );

  }



  return result;

}



/* -------------------------------------------------------------------------- */
/* Territory Map                                                              */
/* -------------------------------------------------------------------------- */

export default function TerritoryMap({
  county,
  territory,
  saving,
  onClose,
  onSave,
}: Props) {


  const [
    countyGeometry,
    setCountyGeometry,
  ] =
    useState<CountyGeometry | null>(
      () =>
        getCountyGeometry(county)
    );



  const [
    loadingBoundary,
    setLoadingBoundary,
  ] =
    useState(false);



  const [
    points,
    setPoints,
  ] =
    useState<LatLng[]>([]);



  const [
    boundary,
    setBoundary,
  ] =
    useState<LatLng[]>([]);



  const [
    error,
    setError,
  ] =
    useState("");



  const [
    editingExisting,
    setEditingExisting,
  ] =
    useState(false);



  const countyPolygon =
    useMemo(
      () =>
        getCountyDisplayPolygon(
          countyGeometry
        ),
      [countyGeometry]
    );



  const center =
    useMemo(
      () =>
        getGeometryCenter(
          countyGeometry
        ),
      [countyGeometry]
    );



  /*
   * مرز موجود منطقه فروش
   */

  const existingBoundary =
    useMemo(() => {


      const coords =
        territory
          ?.geometry
          ?.geometry
          ?.coordinates?.[0] ||
        territory
          ?.geometry
          ?.coordinates?.[0];


      if (
        !Array.isArray(coords)
      ) {

        return [];

      }


      return coords.map(
        (p: number[]) =>
          [
            p[1],
            p[0],
          ] as LatLng
      );

    }, [territory]);



  /* ---------------------------------------------------------------------- */
  /* دریافت مرز شهرستان هنگام باز شدن نقشه                                      */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {


    let cancelled = false;



    async function loadCountyBoundary() {


      setError("");



      /*
       * اگر قبلاً Geometry داریم،
       * دیگر درخواست خارجی نمی‌زنیم.
       */

      if (
        getCountyGeometry(county)
      ) {

        setCountyGeometry(
          getCountyGeometry(county)
        );

        return;

      }



      setLoadingBoundary(true);



      try {


        const geometry =
          await fetchCountyGeometry(
            county
          );



        if (
          cancelled
        ) {

          return;

        }



        if (
          geometry
        ) {

          setCountyGeometry(
            geometry
          );

          return;

        }



        setError(
          "مرز دقیق این شهرستان پیدا نشد. امکان ترسیم امن تا دریافت مرز شهرستان وجود ندارد."
        );



      } catch (
        error: any
      ) {


        if (
          cancelled
        ) {

          return;

        }



        console.error(
          "LOAD COUNTY GEOMETRY ERROR:",
          error
        );



        setError(
          error?.message ||
          "دریافت مرز شهرستان انجام نشد."
        );



      } finally {


        if (
          !cancelled
        ) {

          setLoadingBoundary(
            false
          );

        }

      }

    }



    void loadCountyBoundary();



    return () => {

      cancelled = true;

    };


  }, [county?.id]);



  /* ---------------------------------------------------------------------- */
  /* ایجاد محدوده                                                           */
  /* ---------------------------------------------------------------------- */

  function createBoundary() {


    setError("");



    if (
      points.length < 3
    ) {

      setError(
        "حداقل ۳ نقطه انتخاب کنید."
      );

      return;

    }



    /*
     * Hull اولیه
     */

    const rawBoundary =
      hull(points);



    if (
      rawBoundary.length < 4
    ) {

      setError(
        "ساخت مرز اولیه انجام نشد."
      );

      return;

    }



    /*
     * برش با مرز واقعی شهرستان
     */

    const clipped =
      clipBoundaryToCounty(
        rawBoundary,
        countyGeometry
      );



    if (
      clipped.length < 4
    ) {

      setError(
        "نقاط انتخاب‌شده داخل یک محدوده معتبر از شهرستان قرار نگرفته‌اند."
      );

      return;

    }



    setBoundary(
      clipped
    );


    setPoints([]);


  }



  /* ---------------------------------------------------------------------- */
  /* ویرایش محدوده موجود                                                    */
  /* ---------------------------------------------------------------------- */

  function clearExistingBoundary() {


    setPoints([]);

    setBoundary([]);

    setEditingExisting(
      true
    );

    setError("");

  }



  /* ---------------------------------------------------------------------- */
  /* حذف نقاط                                                                */
  /* ---------------------------------------------------------------------- */

  function clearPoints() {

    setPoints([]);

    setBoundary([]);

    setError("");

  }



  /* ---------------------------------------------------------------------- */
  /* حذف آخرین نقطه                                                          */
  /* ---------------------------------------------------------------------- */

  function undoPoint() {

    setPoints(
      (current) =>
        current.slice(
          0,
          -1
        )
    );

  }



  /* ---------------------------------------------------------------------- */
  /* ذخیره                                                                    */
  /* ---------------------------------------------------------------------- */

  function save() {


    setError("");



    if (
      boundary.length < 4
    ) {

      setError(
        "ابتدا مرز محدوده را بسازید."
      );

      return;

    }



    const coordinates =
      boundary.map(
        ([lat, lng]) =>
          [lng, lat]
      );



    const first =
      coordinates[0];



    const last =
      coordinates[
        coordinates.length - 1
      ];



    if (
      first[0] !== last[0] ||
      first[1] !== last[1]
    ) {

      coordinates.push(
        first
      );

    }



    const geometry = {

      type: "Feature",

      properties: {

        name:
          territory?.name,

        territory_type:
          territory?.type,

        boundary_method:
          "smart_points_county_boundary",

        county_id:
          county?.id || null,

        county_name:
          county?.name || null,

      },

      geometry: {

        type: "Polygon",

        coordinates: [
          coordinates,
        ],

      },

    };



    onSave(
      geometry
    );

  }



  return (

    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "#fff",
        direction: "rtl",
      }}
    >


      <MapContainer

        center={
          center
        }

        zoom={13}

        scrollWheelZoom

        style={{
          width: "100%",
          height: "100%",
        }}

      >


        <TileLayer

          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"

          attribution="&copy; OpenStreetMap contributors"

        />


        <MapController

          center={
            center
          }

          bounds={
            countyPolygon
          }

        />


        <ClickHandler

          countyFeature={
            countyGeometry
              ? geometryToFeature(
                  countyGeometry
                )
              : null
          }

          onClick={(
            point
          ) => {


            /*
             * اگر مرز شهرستان هنوز نیامده،
             * اجازه ترسیم نمی‌دهیم.
             */

            if (
              !countyGeometry
            ) {

              setError(
                "ابتدا مرز شهرستان باید روی نقشه بارگذاری شود."
              );

              return;

            }



            setPoints(
              (old) => [
                ...old,
                point,
              ]
            );


            setBoundary([]);

          }}

        />


        {/* ---------------------------------------------------------------- */}
        {/* مرز شهرستان                                                         */}
        {/* ---------------------------------------------------------------- */}

        {countyPolygon && (

          <Polygon

            positions={
              countyPolygon
            }

            pathOptions={{
              color:
                "#2563eb",

              dashArray:
                "10 7",

              weight:
                4,

              fillColor:
                "#2563eb",

              fillOpacity:
                0.04,
            }}

          />

        )}



        {/* ---------------------------------------------------------------- */}
        {/* نقاط انتخابی                                                     */}
        {/* ---------------------------------------------------------------- */}

        {points.map(
          (
            p,
            index
          ) => (

            <CircleMarker

              key={
                `${p[0]}-${p[1]}-${index}`
              }

              center={p}

              radius={7}

              pathOptions={{
                color:
                  "#dc2626",

                fillColor:
                  "#dc2626",

                fillOpacity:
                  1,

                weight:
                  2,
              }}

            />

          )
        )}



        {/* ---------------------------------------------------------------- */}
        {/* محدوده قبلی                                                      */}
        {/* ---------------------------------------------------------------- */}

        {existingBoundary.length > 0 &&
          !editingExisting && (

            <Polygon

              positions={
                existingBoundary
              }

              pathOptions={{
                color:
                  "#16a34a",

                fillColor:
                  "#22c55e",

                fillOpacity:
                  0.22,

                weight:
                  5,
              }}

            />

          )}



        {/* ---------------------------------------------------------------- */}
        {/* محدوده ساخته‌شده                                                  */}
        {/* ---------------------------------------------------------------- */}

        {boundary.length > 0 && (

          <Polygon

            positions={
              boundary
            }

            pathOptions={{
              color:
                "#149b5c",

              fillColor:
                "#22c55e",

              fillOpacity:
                0.20,

              weight:
                4,
            }}

          />

        )}


      </MapContainer>



      {/* ================================================================== */}
      {/* پنل کنترل                                                          */}
      {/* ================================================================== */}

      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 3000,
          background: "#fff",
          padding: 20,
          borderRadius: 16,
          width: 330,
          maxWidth: "calc(100vw - 40px)",
          boxShadow:
            "0 10px 40px rgba(15,23,42,.20)",
        }}
      >


        <h3
          style={{
            marginTop: 0,
            marginBottom: 8,
            fontSize: 20,
            fontWeight: 900,
          }}
        >
          ساخت محدوده فروش
        </h3>


        <div
          style={{
            color: "#64748b",
            fontSize: 13,
            marginBottom: 15,
          }}
        >
          {county?.name}
        </div>



        {/* وضعیت مرز شهرستان */}

        <div
          style={{
            padding: 10,
            borderRadius: 10,
            background:
              countyGeometry
                ? "#eff6ff"
                : "#fff7ed",
            color:
              countyGeometry
                ? "#1d4ed8"
                : "#9a3412",
            fontSize: 12,
            fontWeight: 800,
            marginBottom: 12,
          }}
        >

          {loadingBoundary
            ? "در حال دریافت مرز دقیق شهرستان..."
            : countyGeometry
              ? "مرز شهرستان آماده است؛ ترسیم فقط داخل این مرز مجاز است."
              : "مرز شهرستان هنوز دریافت نشده است."}

        </div>



        <button

          type="button"

          onClick={
            onClose
          }

          disabled={
            saving
          }

          style={{
            width: "100%",
            marginBottom: 8,
            padding: 10,
            borderRadius: 10,
            border:
              "1px solid #cbd5e1",
            background: "#fff",
            cursor:
              saving
                ? "not-allowed"
                : "pointer",
            fontWeight: 800,
          }}

        >
          ← بازگشت
        </button>



        {existingBoundary.length > 0 &&
          !editingExisting && (

            <button

              type="button"

              onClick={
                clearExistingBoundary
              }

              style={{
                width: "100%",
                marginBottom: 8,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 800,
              }}

            >
              ✏️ ویرایش محدوده فعلی
            </button>

          )}



        {editingExisting && (

          <div
            style={{
              padding: 10,
              borderRadius: 10,
              background: "#ecfdf5",
              color: "#166534",
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            محدوده قبلی پاک شده و می‌توانید
            محدوده جدید را ترسیم کنید.
          </div>

        )}



        <div
          style={{
            fontSize: 13,
            color: "#475569",
            lineHeight: 1.8,
            marginBottom: 10,
          }}
        >
          روی نقاط مختلف شهرستان کلیک کن.
          سپس سیستم محدوده را داخل مرز
          واقعی شهرستان قرار می‌دهد.
        </div>



        <button

          type="button"

          onClick={
            undoPoint
          }

          disabled={
            saving ||
            points.length === 0
          }

          style={{
            width: "100%",
            marginBottom: 8,
            padding: 10,
            borderRadius: 10,
            border:
              "1px solid #cbd5e1",
            background: "#fff",
            cursor:
              points.length
                ? "pointer"
                : "not-allowed",
            fontWeight: 700,
          }}

        >
          حذف آخرین نقطه
        </button>



        <button

          type="button"

          onClick={
            createBoundary
          }

          disabled={
            saving ||
            !countyGeometry ||
            points.length < 3
          }

          style={{
            width: "100%",
            marginBottom: 8,
            padding: 11,
            borderRadius: 10,
            border: "none",
            background:
              !countyGeometry ||
              points.length < 3
                ? "#94a3b8"
                : "#149b5c",
            color: "#fff",
            cursor:
              !countyGeometry ||
              points.length < 3
                ? "not-allowed"
                : "pointer",
            fontWeight: 900,
          }}

        >
          ✨ ساخت مرز محدوده
        </button>



        <button

          type="button"

          onClick={
            clearPoints
          }

          disabled={
            saving ||
            (
              points.length === 0 &&
              boundary.length === 0
            )
          }

          style={{
            width: "100%",
            marginBottom: 8,
            padding: 10,
            borderRadius: 10,
            border:
              "1px solid #fecaca",
            background:
              "#fff1f2",
            color:
              "#b91c1c",
            cursor:
              "pointer",
            fontWeight: 800,
          }}

        >
          پاک کردن
        </button>



        <button

          type="button"

          onClick={
            save
          }

          disabled={
            saving ||
            boundary.length < 4
          }

          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "none",
            background:
              saving ||
              boundary.length < 4
                ? "#94a3b8"
                : "#16a34a",
            color: "#fff",
            cursor:
              saving ||
              boundary.length < 4
                ? "not-allowed"
                : "pointer",
            fontWeight: 900,
          }}

        >
          {saving
            ? "در حال ذخیره..."
            : "ثبت منطقه"}

        </button>



        {error && (

          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 10,
              background:
                "#fee2e2",
              color:
                "#991b1b",
              fontSize: 12,
              lineHeight: 1.7,
              fontWeight: 700,
            }}
          >
            {error}
          </div>

        )}

      </div>

    </div>

  );

}