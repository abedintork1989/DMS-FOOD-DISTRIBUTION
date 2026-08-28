"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import "leaflet/dist/leaflet.css";

import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

type Territory = {
  province: string;
  region: string;
};

type Visitor = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  active: boolean | null;
  tracking_enabled: boolean | null;
  territories: Territory[];
};

type Customer = {
  id: string;
  name: string | null;
};

/**
 * Leaflet must only be rendered in the browser.
 * The previous implementation imported MapContainer/TileLayer directly,
 * which caused Next.js prerendering to evaluate browser-only code and throw:
 * ReferenceError: window is not defined
 */
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

export default function VisitorControlPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [visitorResult, customerResult, territoryResult] =
      await Promise.all([
        supabase
          .from("sales_visitors")
          .select("id,full_name,phone,avatar_url,active,tracking_enabled")
          .order("full_name"),

        supabase.from("customers").select("id,name"),

        supabase
          .from("sales_visitor_territories")
          .select("visitor_id,province,region")
          .eq("active", true),
      ]);

    const territoryMap = new Map<string, Territory[]>();

    (territoryResult.data ?? []).forEach((item: any) => {
      const current = territoryMap.get(item.visitor_id) ?? [];

      current.push({
        province: item.province ?? "-",
        region: item.region ?? "-",
      });

      territoryMap.set(item.visitor_id, current);
    });

    const data = (visitorResult.data ?? []).map((visitor: any) => ({
      ...visitor,
      territories: territoryMap.get(visitor.id) ?? [],
    }));

    setVisitors(data);
    setCustomers((customerResult.data ?? []) as Customer[]);
    setLoading(false);
  }

  const visitorList = useMemo(() => visitors, [visitors]);

  return (
    <AppShell>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
        }}
      >
        <section className="dashboard-panel">
          <div style={{ overflowX: "auto", marginTop: 20 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>تصویر</th>
                  <th>نام ویزیتور</th>
                  <th>استان</th>
                  <th>منطقه</th>
                  <th>وضعیت</th>
                  <th>ردیابی</th>
                  <th>مشتریان هدف روز</th>
                  <th>مشتریان ویزیت شده</th>
                  <th>مشتریان باقی مانده</th>
                  <th>عملیات</th>
                </tr>
              </thead>

              <tbody>
                {visitorList.map((visitor) => (
                  <tr key={visitor.id}>
                    <td>
                      {visitor.avatar_url ? (
                        <img
                          src={visitor.avatar_url}
                          alt={visitor.full_name ?? ""}
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "1px solid #dbe3ea",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            background: "#e9f4ef",
                            color: "#0f6b43",
                            fontWeight: 800,
                          }}
                        >
                          {(visitor.full_name ?? "و")[0]}
                        </div>
                      )}
                    </td>

                    <td>{visitor.full_name ?? "-"}</td>

                    <td>
                      {[...new Set(
                        visitor.territories.map((item) => item.province)
                      )].join("، ") || "-"}
                    </td>

                    <td>
                      {visitor.territories
                        .map((item) => item.region)
                        .join("، ") || "-"}
                    </td>

                    <td>{visitor.active ? "فعال" : "غیرفعال"}</td>

                    <td>
                      {visitor.tracking_enabled ? "فعال" : "خاموش"}
                    </td>

                    <td>0</td>
                    <td>0</td>
                    <td>0</td>

                    <td>
                      <button type="button">
                        <Eye size={16} />
                        مشاهده
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-panel">
          <div
            style={{
              height: "600px",
              margin: 0,
              padding: 0,
              borderRadius: 0,
              overflow: "hidden",
              width: "100%",
            }}
          >
            <MapContainer
              center={[35.6892, 51.389]}
              zoom={11}
              style={{
                width: "100%",
                height: "100%",
                margin: 0,
                padding: 0,
              }}
              scrollWheelZoom
            >
              <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
            </MapContainer>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
