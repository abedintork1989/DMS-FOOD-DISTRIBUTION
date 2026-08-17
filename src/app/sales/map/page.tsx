"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPinned, AlertTriangle } from "lucide-react";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import {
  normalizeProvinceName,
  settlementLabel,
} from "@/lib/provinceUtils";
import type { MapCustomer } from "@/components/Map/mapTypes";
import CustomerMapToolbar from "@/components/Map/CustomerMapToolbar";

// نقشه فقط سمت کلاینت لود می‌شود (Leaflet به window نیاز دارد)
const CustomerMapCanvas = dynamic(() => import("@/components/Map/CustomerMapCanvas"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "#64748b",
      }}
    >
      در حال بارگذاری نقشه...
    </div>
  ),
});

type VisitorOption = {
  id: string;
  full_name: string;
};

type SettlementFilter = "all" | "cash" | "credit" | "unlimited";

export default function CustomerMapPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<MapCustomer[]>([]);
  const [visitors, setVisitors] = useState<VisitorOption[]>([]);
  const [provincesGeoJson, setProvincesGeoJson] = useState<any>(null);
  const [iranBorderGeoJson, setIranBorderGeoJson] = useState<any>(null);

  const [mode, setMode] = useState<"markers" | "regions">("markers");
  const [visitorFilter, setVisitorFilter] = useState<string>("");
  const [settlementFilter, setSettlementFilter] = useState<SettlementFilter>("all");
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);


  useEffect(() => {
    loadMapData();
    loadProvincesGeoJson();
    loadIranBorderGeoJson();
  }, []);

  async function loadIranBorderGeoJson() {
    try {
      const res = await fetch("/data/iran-border.geojson");
      const data = await res.json();
      setIranBorderGeoJson(data);
    } catch (error) {
      console.error("LOAD IRAN BORDER GEOJSON ERROR:", error);
    }
  }

  async function loadProvincesGeoJson() {
    try {
      const res = await fetch("/geojson/iran-provinces.json");
      const data = await res.json();
      setProvincesGeoJson(data);
    } catch (error) {
      console.error("LOAD PROVINCES GEOJSON ERROR:", error);
    }
  }

  async function loadMapData() {
    setLoading(true);

    try {
      const [
        { data: locations, error: locError },
        { data: visitorRows, error: visitorError },
        { data: groupRows, error: groupError },
      ] = await Promise.all([
        supabase
          .from("customer_locations")
          .select("customer_id,latitude,longitude"),
        supabase
          .from("sales_visitors")
          .select("id,full_name")
          .eq("active", true)
          .order("full_name", { ascending: true }),
        supabase
          .from("customer_groups")
          .select("id,primary_customer_id"),
      ]);

      if (locError) {
        console.error("LOAD LOCATIONS ERROR:", locError);
        setCustomers([]);
        return;
      }

      if (groupError) {
        console.error("LOAD CUSTOMER GROUPS ERROR:", groupError);
      }

      setVisitors(
        (visitorRows || []).map((v: any) => ({
          id: String(v.id),
          full_name: String(v.full_name || ""),
        }))
      );

      // شناسه مشتری‌هایی که «مادر مجموعه» هستند؛ این‌ها شعبه محسوب نمی‌شوند
      const primaryCustomerIds = new Set(
        (groupRows || []).map((g: any) => String(g.primary_customer_id))
      );

      const customerIds = (locations || []).map((l: any) => l.customer_id);

      if (customerIds.length === 0) {
        setCustomers([]);
        return;
      }

      const { data: customerRows, error: customerError } = await supabase
        .from("customers")
        .select("id,name,phone,address,province,visitor,sales_visitor_id,settlement_days,customer_group_id,customer_type")
        .in("id", customerIds);

      if (customerError) {
        console.error("LOAD CUSTOMERS FOR MAP ERROR:", customerError);
        setCustomers([]);
        return;
      }

      const customerMap = new Map(
        (customerRows || []).map((c: any) => [String(c.id), c])
      );

      const merged: MapCustomer[] = (locations || [])
        .map((loc: any) => {
          const c = customerMap.get(String(loc.customer_id));
          if (!c) return null;

          // اگر مشتری مادر مجموعه است و زیرمجموعه دارد، خودش روی نقشه نمایش داده نشود.
          // فقط زیرمجموعه‌ها (شعبه‌ها) نمایش داده شوند.
          const isParentWithBranches = primaryCustomerIds.has(String(c.id));

          if (isParentWithBranches) return null;

          return {
            id: String(c.id),
            name: c.name || "بدون نام",
            phone: c.phone || null,
            address: c.address || null,
            province: c.province || null,
            visitor: c.visitor || null,
            settlement_days: c.settlement_days ?? null,
            customer_type: c.customer_type || null,
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
          } as MapCustomer;
        })
        .filter(Boolean) as MapCustomer[];

      setCustomers(merged);
    } finally {
      setLoading(false);
    }
  }

  // ==========================
  //  فیلتر کردن مشتریان
  // ==========================
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (visitorFilter) {
        // فیلتر بر اساس نام ویزیتور (چون در جدول مشتریان هم نام و هم شناسه ذخیره شده)
        const visitorName = visitors.find((v) => v.id === visitorFilter)?.full_name;
        if (!visitorName || c.visitor !== visitorName) return false;
      }

      if (settlementFilter === "cash" && (c.settlement_days ?? 0) !== 0) return false;
      if (settlementFilter === "credit" && !((c.settlement_days ?? 0) > 0)) return false;
      if (settlementFilter === "unlimited" && c.settlement_days !== -1) return false;

      return true;
    });
  }, [customers, visitorFilter, settlementFilter, visitors]);

  // ==========================
  //  تجمیع بر اساس استان
  // ==========================
  const { provinceCounts, provinceCentroids, maxProvinceCount, unmatchedCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    const sums: Record<string, { latSum: number; lngSum: number; count: number }> = {};
    let unmatched = 0;

    for (const c of filteredCustomers) {
      const name = normalizeProvinceName(c.province);

      if (!name) {
        unmatched++;
        continue;
      }

      counts[name] = (counts[name] || 0) + 1;

      if (!sums[name]) {
        sums[name] = { latSum: 0, lngSum: 0, count: 0 };
      }

      sums[name].latSum += c.latitude;
      sums[name].lngSum += c.longitude;
      sums[name].count += 1;
    }

    const centroids: Record<string, { lat: number; lng: number; count: number }> = {};

    for (const name of Object.keys(sums)) {
      const s = sums[name];
      centroids[name] = {
        lat: s.latSum / s.count,
        lng: s.lngSum / s.count,
        count: s.count,
      };
    }

    const max = Object.values(counts).reduce((m, v) => Math.max(m, v), 0);

    return {
      provinceCounts: counts,
      provinceCentroids: centroids,
      maxProvinceCount: max,
      unmatchedCount: unmatched,
    };
  }, [filteredCustomers]);

  const coveredProvincesCount = Object.keys(provinceCounts).length;

  const topProvince = useMemo(() => {
    const entries = Object.entries(provinceCounts).sort((a, b) => b[1] - a[1]);
    return entries.length > 0 ? { name: entries[0][0], count: entries[0][1] } : null;
  }, [provinceCounts]);

  const selectedProvinceCustomers = useMemo(() => {
    if (!selectedProvince) return [];
    return filteredCustomers.filter(
      (c) => normalizeProvinceName(c.province) === selectedProvince
    );
  }, [filteredCustomers, selectedProvince]);

  const hasAnyCustomerLocation = customers.length > 0;

  return (
    <AppShell>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
        {/* ========== لیست مشتریان استان انتخاب‌شده (فقط حالت مناطق) ========== */}
        {mode === "regions" && selectedProvince && (
          <div className="panel" style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <strong style={{ fontSize: 14 }}>مشتریان استان {selectedProvince}</strong>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => setSelectedProvince(null)}
              >
                بستن
              </button>
            </div>

            {selectedProvinceCustomers.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b" }}>
                مشتری‌ای در این استان یافت نشد.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                {selectedProvinceCustomers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/customers/${c.id}`}
                    style={{
                      display: "block",
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                    {c.address && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        {c.address}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                      {settlementLabel(c.settlement_days)}
                      {c.visitor ? ` · ${c.visitor}` : ""}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========== نقشه (تمام‌عرض) ========== */}
        <div style={{ position: "relative" }}>
          <div
            className="panel"
            style={{
              padding: 0,
              height: 680,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <CustomerMapToolbar visitors={visitors} />
          {loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#64748b",
              }}
            >
              در حال دریافت موقعیت مشتریان...
            </div>
          ) : !hasAnyCustomerLocation ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#64748b",
                gap: 8,
                padding: 24,
                textAlign: "center",
              }}
            >
              <MapPinned size={32} />
              <strong>هنوز هیچ مشتری‌ای موقعیت جغرافیایی ثبت نکرده</strong>
              <span style={{ fontSize: 13 }}>
                از پرونده هر مشتری، روی «ثبت موقعیت روی نقشه» بزنید تا اینجا نمایش داده شود.
              </span>
            </div>
          ) : (
            <CustomerMapCanvas
              mode={mode}
              customers={filteredCustomers}
              iranBorderGeoJson={iranBorderGeoJson}
              provincesGeoJson={provincesGeoJson}
              provinceCounts={provinceCounts}
              provinceCentroids={provinceCentroids}
              maxProvinceCount={maxProvinceCount}
              selectedProvince={selectedProvince}
              onSelectProvince={setSelectedProvince}
            />
          )}
        </div>
          </div>
      </div>
    </AppShell>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
