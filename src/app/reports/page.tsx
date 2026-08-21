"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import {
  AlertTriangle,
  TrendingUp,
  WalletCards,
  Banknote,
  ArrowLeft,
} from "lucide-react";

type ReportCard = {
  title: string;
  subtitle: string;
  href: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

const reportCards: ReportCard[] = [
  {
    title: "افت فروش",
    subtitle: "بررسی علل افت فروش، ریزش مشتری و فروش از دست‌رفته",
    href: "/reports/sales-decline",
    icon: AlertTriangle,
  },
  {
    title: "رشد فروش",
    subtitle: "بررسی عوامل رشد فروش و فرصت‌های توسعه فروش",
    href: "/reports/sales-growth",
    icon: TrendingUp,
  },
  {
    title: "سود فروش",
    subtitle: "بررسی سودآوری مشتری، محصول و نیروی فروش",
    href: "/reports/sales-profit",
    icon: WalletCards,
  },
  {
    title: "نقدینگی",
    subtitle: "بررسی وصول مطالبات، بدهی‌ها و جریان نقدی فروش",
    href: "/reports/liquidity",
    icon: Banknote,
  },
];

export default function ReportsPage() {
  return (
    <AppShell>
      <PageHeader
        title="گزارش‌ها"
        subtitle="گزارش‌های مدیریتی فروش را از بین چهار محور اصلی انتخاب کنید"
      />

      <div
        style={{
          width: "100%",
          maxWidth: 1350,
          margin: "30px auto 0",
          padding: "0 12px 40px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 22,
            alignItems: "stretch",
          }}
        >
          {reportCards.map((report) => {
            const Icon = report.icon;

            return (
              <Link
                key={report.title}
                href={report.href}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                  height: 330,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    padding: 26,
                    border: "1px solid #d8e8dc",
                    borderRadius: 22,
                    background:
                      "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(246,251,248,0.98))",
                    boxShadow: "0 14px 35px rgba(18, 67, 43, 0.08)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "transform .18s ease, box-shadow .18s ease",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.transform = "translateY(-4px)";
                    event.currentTarget.style.boxShadow =
                      "0 18px 40px rgba(18, 67, 43, 0.14)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.transform = "translateY(0)";
                    event.currentTarget.style.boxShadow =
                      "0 14px 35px rgba(18, 67, 43, 0.08)";
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      width: 150,
                      height: 150,
                      borderRadius: "50%",
                      background: "rgba(21, 128, 61, .06)",
                      top: -70,
                      left: -55,
                    }}
                  />

                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        display: "grid",
                        placeItems: "center",
                        background: "#e8f7ed",
                        color: "#0f7045",
                        marginBottom: 22,
                      }}
                    >
                      <Icon size={28} strokeWidth={2.1} />
                    </div>

                    <h2
                      style={{
                        margin: 0,
                        color: "#173f2d",
                        fontSize: 24,
                        fontWeight: 900,
                      }}
                    >
                      {report.title}
                    </h2>

                    <p
                      style={{
                        margin: "12px 0 0",
                        color: "#71867b",
                        fontSize: 13,
                        lineHeight: 1.9,
                      }}
                    >
                      {report.subtitle}
                    </p>
                  </div>

                  <div
                    style={{
                      position: "relative",
                      zIndex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 24,
                      paddingTop: 16,
                      borderTop: "1px solid #e8f0ea",
                      color: "#0f7045",
                      fontWeight: 800,
                      fontSize: 12,
                    }}
                  >
                    <span>ورود به گزارش</span>
                    <ArrowLeft size={17} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
