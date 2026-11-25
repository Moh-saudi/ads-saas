import type { CSSProperties, ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";
import "./agency.css";
import "./dashboard.css";
import "./invoice.css";
import { Pwa } from "@/components/pwa";
import { shareMetadata, siteDescription } from "@/lib/share-metadata";

const cairo = localFont({
  src: "./fonts/Cairo.ttf",
  weight: "200 1000",
  variable: "--font-cairo",
  display: "swap",
});

const tajawal = localFont({
  src: [
    { path: "./fonts/Tajawal-Regular.ttf", weight: "400" },
    { path: "./fonts/Tajawal-Medium.ttf", weight: "500" },
    { path: "./fonts/Tajawal-Bold.ttf", weight: "700" },
    { path: "./fonts/Tajawal-ExtraBold.ttf", weight: "800" },
  ],
  variable: "--font-dashboard-arabic",
  display: "swap",
});

const dashboardNumbers = localFont({
  src: "./fonts/Inter.ttf",
  weight: "100 900",
  variable: "--font-dashboard-numbers",
  // Arabic glyphs fall through to Tajawal instead of an Arial fallback.
  adjustFontFallback: false,
  display: "swap",
});

export const metadata = {
  ...shareMetadata(),
  title: { default: "مِسك | إدارة المساحات الإعلانية", template: "%s | مِسك" },
  description: siteDescription,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  appleWebApp: { capable: true, title: "Mesk", statusBarStyle: "default" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1f4d",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body
        className={`${cairo.className} ${cairo.variable} ${tajawal.variable} ${dashboardNumbers.variable}`}
        style={{
          "--font-dashboard-latin": dashboardNumbers.style.fontFamily.split(",")[0],
          "--font-dashboard-arabic": tajawal.style.fontFamily.split(",")[0],
        } as CSSProperties}
      >
        {children}
        <Pwa />
      </body>
    </html>
  );
}
