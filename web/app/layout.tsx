import type { ReactNode } from "react";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Pwa } from "@/components/pwa";
const cairo = Cairo({ subsets: ["arabic", "latin"], display: "swap" });
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
      <body className={cairo.className}>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
