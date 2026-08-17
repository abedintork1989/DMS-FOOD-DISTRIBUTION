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
import MapHeaderTabs, {
  HeaderTab,
  CustomerMapFilter,
  CUSTOMER_FILTER_COLORS,
} from "@/components/Map/MapHeaderTabs";

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

function normalizeCustomerType(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\u200c/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\sـ]+/g, "")
    .toLowerCase();
}

const AT_RISK_CUSTOMER_DAYS = 60;
const LOST_CUSTOMER_DAYS = 90;

export default function CustomerMapPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<MapCustomer[]>([]);
  const [visitors, setVisitors] = useState<VisitorOption[]>([]);
  const [provincesGeoJson, setProvincesGeoJson] = useState<any>(null);
  const [iranBorderGeoJson, setIranBorderGeoJson] = useState<any>(null);

  const [mode, setMode] = useState<"markers" | "regions">("markers");
  const [visitorFilter, setVisitorFilter] = useState<string>("");
  const [settlementFilter, setSettlementFilter] = useState<SettlementFilter>("all");
  const [customerFilter, setCustomerFilter] = useState<CustomerMapFilter | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  // تب فعال هدر بالای صفحه (فیلترها / آمار / راهنما)
  const [activeTab, setActiveTab] = useState<HeaderTab>(null);

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
        { data: ordersRows, error: ordersError },
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
        supabase
          .from("orders")
          .select("customer_id,created_at")
          .eq("status", "delivered"),
      ]);

      if (locError) {
        console.error("LOAD LOCATIONS ERROR:", locError);
        setCustomers([]);
        return;
      }

      if (groupError) {
        console.error("LOAD CUSTOMER GROUPS ERROR:", groupError);
      }

      if (ordersError) {
        console.error("LOAD DELIVERED ORDERS ERROR:", ordersError);
      }

      const deliveredOrders = ordersRows || [];

      setVisitors(
        (visitorRows || []).map((v: any) => ({
          id: String(v.id),
          full_name: String(v.full_name || ""),
        }))
      );
      const customerIds = (locations || []).map((l: any) => l.customer_id);

      if (customerIds.length === 0) {
        setCustomers([]);
        return;
      }

      const { data: customerRows, error: customerError } = await supabase
        .from("customers")
        .select("id,name,phone,address,province,visitor,sales_visitor_id,settlement_days,customer_group_id,customer_type,active")
        .in("id", customerIds);

      if (customerError) {
        console.error("LOAD CUSTOMERS FOR MAP ERROR:", customerError);
        setCustomers([]);
        return;
      }

      const orderStats = new Map<string, { count: number; lastOrderAt: number | null }>();
      for (const order of deliveredOrders as any[]) {
        if (!order.customer_id) continue;
        const customerId = String(order.customer_id);
        const createdAt = order.created_at ? new Date(order.created_at).getTime() : null;
        const current = orderStats.get(customerId) || { count: 0, lastOrderAt: null };
        current.count += 1;
        if (createdAt !== null && (current.lastOrderAt === null || createdAt > current.lastOrderAt)) {
          current.lastOrderAt = createdAt;
        }
        orderStats.set(customerId, current);
      }

      const customerMap = new Map(
        (customerRows || []).map((c: any) => [String(c.id), c])
      );

      const merged: MapCustomer[] = (locations || [])
        .map((loc: any) => {
          const c = customerMap.get(String(loc.customer_id));
          if (!c) return null;
return {
            id: String(c.id),
            name: c.name || "بدون نام",
            phone: c.phone || null,
            address: c.address || null,
            province: c.province || null,
            visitor: c.visitor || null,
            settlement_days: c.settlement_days ?? null,
            active: Boolean(c.active),
            customer_type: c.customer_type || null,
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
          } as MapCustomer;
        })
        .filter(Boolean) as MapCustomer[];

      const mergedWithOrderStats = merged.map((customer: any) => {
        const stat = orderStats.get(String(customer.id));
        return {
          ...customer,
          __orderCount: stat?.count || 0,
          __lastOrderAt: stat?.lastOrderAt ?? null,
        };
      });

      setCustomers(mergedWithOrderStats);
    } finally {
      setLoading(false);
    }
  }

  // ==========================
  //  فیلتر کردن مشتریان
  // ==========================
  const filteredCustomers = useMemo(() => {
    const now = Date.now();
    const days = (timestamp: number | null) =>
      timestamp === null ? null : (now - timestamp) / 86400000;

    return customers.filter((c: any) => {
      const customerType = normalizeCustomerType(c.customer_type);

      const isChainCustomer = customerType === normalizeCustomerType("زنجیره‌ای");
      const isVipCustomer = customerType === "vip";
      const isRetailCustomer = customerType === normalizeCustomerType("مویرگی");

      if (customerFilter === "chain" && !isChainCustomer) return false;
      if (customerFilter === "vip" && !isVipCustomer) return false;
      if (customerFilter === "retail" && !isRetailCustomer) return false;
      if (customerFilter === "active" && !c.active) return false;
      if (customerFilter === "inactive" && c.active) return false;

      const orderCount = Number(c.__orderCount || 0);
      const lastOrderAgeDays = days(c.__lastOrderAt ?? null);

      if (customerFilter === "first_purchase" && orderCount !== 1) return false;
      if (customerFilter === "regular" && orderCount < 2) return false;
      if (customerFilter === "lost" && !(orderCount > 0 && lastOrderAgeDays !== null && lastOrderAgeDays > LOST_CUSTOMER_DAYS)) return false;
      if (customerFilter === "at_risk" && !(orderCount > 0 && lastOrderAgeDays !== null && lastOrderAgeDays > AT_RISK_CUSTOMER_DAYS && lastOrderAgeDays <= LOST_CUSTOMER_DAYS)) return false;

      if (visitorFilter) {
        const visitorName = visitors.find((v) => v.id === visitorFilter)?.full_name;
        if (!visitorName || c.visitor !== visitorName) return false;
      }

      if (settlementFilter === "cash" && (c.settlement_days ?? 0) !== 0) return false;
      if (settlementFilter === "credit" && !((c.settlement_days ?? 0) > 0)) return false;
      if (settlementFilter === "unlimited" && c.settlement_days !== -1) return false;

      return true;
    });
  }, [customers, customerFilter, visitorFilter, settlementFilter, visitors]);

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

  const markerColor = customerFilter
    ? CUSTOMER_FILTER_COLORS[customerFilter]
    : "#dc2626";

  return (
    <AppShell>
      {/* ========== تنها هدر بالای صفحه (یک نوار واحد، بدون تکرار) ========== */}
      <MapHeaderTabs
        mode={mode}
        onModeChange={setMode}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showLegendTab={mode === "regions"}
        selectedCustomerFilter={customerFilter}
        onCustomerFilterChange={setCustomerFilter}
      />

      {/* ========== محتوای تب فعال ========== */}
      {activeTab === "filters" && (
        <div className="panel" style={{ padding: 16, marginBottom: 18 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <div className="form-field">
              <label>ویزیتور</label>
              <select
                className="input"
                value={visitorFilter}
                onChange={(e) => setVisitorFilter(e.target.value)}
              >
                <option value="">همه ویزیتورها</option>
                {visitors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>وضعیت تسویه</label>
              <select
                className="input"
                value={settlementFilter}
                onChange={(e) => setSettlementFilter(e.target.value as SettlementFilter)}
              >
                <option value="all">همه</option>
                <option value="cash">نقدی</option>
                <option value="credit">اعتباری (چند روزه)</option>
                <option value="unlimited">بدون محدودیت</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === "stats" && (
        <div className="panel" style={{ padding: 16, marginBottom: 18 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <StatRow label="تعداد مشتریان روی نقشه" value={filteredCustomers.length.toLocaleString("fa-IR")} />
            <StatRow label="استان‌های پوشش‌داده‌شده" value={`${coveredProvincesCount.toLocaleString("fa-IR")} از ۳۱`} />
            <StatRow
              label="پرمشتری‌ترین استان"
              value={topProvince ? `${topProvince.name} (${topProvince.count.toLocaleString("fa-IR")})` : "—"}
            />
          </div>

          {unmatchedCount > 0 && (
            <div
              style={{
                marginTop: 14,
                padding: 10,
                borderRadius: 8,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#854d0e",
                fontSize: 12,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {unmatchedCount.toLocaleString("fa-IR")} مشتری استان مشخصی ندارند. با ثبت دوباره موقعیت روی
                نقشه در پرونده مشتری، استان به‌صورت خودکار تشخیص داده می‌شود.
              </span>
            </div>
          )}
        </div>
      )}

      {activeTab === "legend" && mode === "regions" && (
        <div className="panel" style={{ padding: 16, marginBottom: 18, fontSize: 12, color: "#64748b" }}>
          <div style={{ marginBottom: 8, fontWeight: 700, color: "#334155" }}>راهنمای رنگ</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: "#d7f2e3", display: "inline-block" }} />
            کم
            <span style={{ width: 14, height: 14, borderRadius: 4, background: "#0f6b43", display: "inline-block", marginRight: 10 }} />
            زیاد
          </div>
          <div style={{ marginTop: 8 }}>
            دایره‌های کم‌رنگ روی نقشه، نقاط تمرکز واقعی مشتریان را نسبت به مرکز استان نشان می‌دهند.
          </div>
        </div>
      )}

      <div
        style={{
          margin: "0 0 12px",
          padding: "12px 16px",
          background: "#fff4e5",
          border: "3px solid #f59e0b",
          borderRadius: 10,
          color: "#92400e",
          fontWeight: 800,
          fontSize: 15,
          textAlign: "center",
          direction: "rtl",
        }}
      >
        تست اتصال فایل صفحه نقشه — اگر این نوار را می‌بینی یعنی همین page.tsx در حال اجراست.
      </div>

      <PageHeader
        title="نقشه پراکندگی مشتریان"
        subtitle="موقعیت جغرافیایی، تراکم مشتریان و پوشش استان‌ها را روی نقشه ایران ببینید"
      />

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
        <div
          className="panel"
          style={{
            padding: 0,
            height: 680,
            overflow: "hidden",
            position: "relative",
          }}
        >
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
