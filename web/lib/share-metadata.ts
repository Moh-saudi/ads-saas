import type { Metadata } from "next";

export const siteDescription = "حلول إعلانية خارجية وإدارة اللوحات والمواقع والعقود والتحصيلات من مكان واحد.";
export const defaultSiteOrigin = "https://ads-kappa-one.vercel.app";
// A small, static PNG is directly accessible to social crawlers.
export const shareLogo = "/media/brand/mesk-share.png";
export const showcaseTitle = "ميسك | ديمو نظام إدارة شركات الإعلان";
export const showcaseDescription = "نسخة تجريبية من تطوير ميسك: موقع لشركة إعلانات مرتبط بنظام لإدارة اللوحات والمواقع والعقود والتحصيلات. البيانات المعروضة للتجربة فقط.";

export function showcaseMetadata(): Metadata {
  return {
    ...shareMetadata({ title: showcaseTitle, description: showcaseDescription, name: "ميسك — الشركة المطوّرة" }),
    title: { absolute: showcaseTitle },
    description: showcaseDescription,
  };
}

export function shareMetadata({
  origin = defaultSiteOrigin,
  title = "ميسك | نظام إدارة شركات الإعلان",
  description = siteDescription,
  name = "ميسك — الشركة المطوّرة",
  logo,
}: {
  origin?: string;
  title?: string;
  description?: string;
  name?: string;
  logo?: string | null;
} = {}): Metadata {
  const images = logo
    ? [{ url: logo, alt: name }]
    : [{ url: shareLogo, width: 1200, height: 400, type: "image/png", alt: "Mesk | vlab Ai" }];
  return {
    metadataBase: new URL(origin),
    openGraph: { type: "website", locale: "ar_EG", siteName: name, title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
