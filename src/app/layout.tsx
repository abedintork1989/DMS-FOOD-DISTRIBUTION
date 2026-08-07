import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DMS | سیستم مدیریت شرکت پخش",
  description: "سیستم مدیریت شرکت پخش مواد غذایی"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
