"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function LeafletMap() {
  return (
    <MapContainer
      center={[35.6892, 51.389]}
      zoom={6}
      scrollWheelZoom={true}
      style={{
        width: "100%",
        height: "600px",
      }}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="OpenStreetMap"
      />
    </MapContainer>
  );
}