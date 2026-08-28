"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

type LatLng = [number, number];

type TerritoryGeometry =
  | LatLng[]
  | LatLng[][]
  | LatLng[][][];

const TerritoryCanvas = dynamic(
  () => import("@/components/territories/TerritoryCanvas"),
  {
    ssr: false,
  }
);

type Props = {
  onClose: () => void;
  onSave: (geometry: any) => void;
};

export default function TerritoryCreator({
  onClose,
  onSave,
}: Props) {
  const [points, setPoints] = useState<LatLng[]>([]);
  const [boundary, setBoundary] = useState<LatLng[]>([]);

  function createBoundary() {
    if (points.length < 3) return;

    setBoundary([...points, points[0]]);
  }

  function save() {
    if (boundary.length < 4) return;

    onSave({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          boundary.map(([lat, lng]) => [lng, lat]),
        ],
      },
    });
  }

  function handleMapPoint(point: LatLng) {
    setPoints((current) => [...current, point]);
    setBoundary([]);
  }

  function handleMovePoint(index: number, point: LatLng) {
    setPoints((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? point : item
      )
    );
    setBoundary([]);
  }

  const previewGeometry: TerritoryGeometry | null =
    boundary.length >= 3 ? boundary : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5000,
      }}
    >
      <TerritoryCanvas
        drawing={true}
        draftPoints={points}
        territories={[]}
        countyBoundary={null}
        previewGeometry={previewGeometry}
        onMapPoint={handleMapPoint}
        onMovePoint={handleMovePoint}
        focusTerritoryId={null}
        hiddenTerritoryId={null}
      />

      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 6000,
          background: "#fff",
          padding: 20,
          borderRadius: 16,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button type="button" onClick={onClose}>
          بازگشت
        </button>

        <button type="button" onClick={createBoundary}>
          ساخت مرز هوشمند
        </button>

        <button type="button" onClick={save}>
          ثبت منطقه
        </button>

        <button
          type="button"
          onClick={() => {
            setPoints([]);
            setBoundary([]);
          }}
        >
          پاک کردن
        </button>
      </div>
    </div>
  );
}
