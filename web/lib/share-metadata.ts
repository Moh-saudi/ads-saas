import type { Metadata } from "next";

export const siteDescription = "حلول إعلانية خارجية وإدارة اللوحات والمواقع والعقود والتحصيلات من مكان واحد.";
export const defaultSiteOrigin = "https://ads-kappa-one.vercel.app";
// Use Next's public image optimizer so crawlers download a smaller PNG.
export const shareLogo = "/_next/image?url=%2Fmedia%2Fbrand%2Fmesk-vlab-logo.png&w=1200&q=75";

export function shareMetadata({
  origin = defaultSiteOrigin,
  title = "مِسك | الإعلان وإدارة المساحات الإعلانية",
  description = siteDescription,
  name = "مِسك للإعلان",
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
