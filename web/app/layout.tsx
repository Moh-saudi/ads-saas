import type { CSSProperties, ReactNode } from "react";
import { Cairo, Tajawal, Inter } from "next/font/google";
import "./globals.css";
import "./agency.css";
import "./dashboard.css";
import "./invoice.css";
import { Pwa } from "@/components/pwa";
import { shareMetadata, siteDescription } from "@/lib/share-metadata";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-tajawal",
  display: "swap",
});

const dashboardNumbers = Inter({
  subsets: ["latin"],
  variable: "--font-dashboard-numbers",
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
        className={`${tajawal.className} ${tajawal.variable} ${cairo.variable} ${dashboardNumbers.variable}`}
        style={{
          "--font-dashboard-latin": dashboardNumbers.style.fontFamily,
          "--font-dashboard-arabic": tajawal.style.fontFamily,
        } as CSSProperties}
      >
        {children}
        <Pwa />
      </body>
    </html>
  );
}
