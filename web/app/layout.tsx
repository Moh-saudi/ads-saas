import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";
import "./agency.css";
import "./dashboard.css";
import "./invoice.css";
import { Pwa } from "@/components/pwa";
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
  title: { default: "مِسك | إدارة المساحات الإعلانية", template: "%s | مِسك" },
  description: "إدارة اللوحات والعقود والمواقع الإعلانية من مكان واحد.",
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
      <body className={`${tajawal.className} ${tajawal.variable} ${dashboardNumbers.variable}`}>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
