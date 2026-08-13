
import DesktopViewport from "@/components/DesktopViewport";

import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";


const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-vazirmatn",
});

export const metadata: Metadata = {
  title: "DMS | سیستم مدیریت شرکت پخش",
  description: "سیستم مدیریت شرکت پخش مواد غذایی",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={vazirmatn.variable}
    >
      <body>
  <DesktopViewport baseWidth={1280}>
    {children}
  </DesktopViewport>
</body>
    </html>
  );
}