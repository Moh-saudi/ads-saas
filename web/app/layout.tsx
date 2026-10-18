import type { ReactNode } from "react";
import { Cairo, Tajawal, Inter } from "next/font/google";
import "./globals.css";
import "./agency.css";
import "./dashboard.css";
import { Pwa } from "@/components/pwa";
const cairo = Cairo({ subsets: ["arabic", "latin"], display: "swap" });
const dashboardArabic = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-dashboard-arabic",
  display: "swap",
});
const dashboardNumbers = Inter({
  subsets: ["latin"],
  variable: "--font-dashboard-numbers",
  // Let Arabic glyphs fall through to Tajawal rather than Inter's Arial fallback.
  adjustFontFallback: false,
  display: "swap",
});
export const metadata = {
  title: { default: "مِسك | إدارة المساحات الإعلانية", template: "%s | مِسك" },
  description: "إدارة الأصول والعقود والمواقع الإعلانية من مكان واحد.",
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
      <body className={`${cairo.className} ${dashboardArabic.variable} ${dashboardNumbers.variable}`}>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
