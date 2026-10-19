import { redirect } from "next/navigation";
import Link from "next/link";
import { getBrand } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { configured } from "@/lib/env";
import { normalizeHost } from "@/lib/host";
import { headers } from "next/headers";
import { PublicSite } from "@/components/public-site";
import { shareMetadata, siteDescription, defaultSiteOrigin, showcaseMetadata } from "@/lib/share-metadata";
import { isShowcaseHost } from "@/lib/showcase-host";
import { ProductShowcase } from "@/components/product-showcase";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  if (isShowcaseHost((await headers()).get("host") || "")) return showcaseMetadata();
  const brand = await getBrand();
  const name = brand?.name || "مِسك للإعلان";
  const title = brand?.website_title ? `${name} | ${brand.website_title}` : `${name} | حلول الإعلان الخارجي`;
  const description = brand?.website_description || siteDescription;
  const host = normalizeHost((await headers()).get("host") || "");
  return {
    ...shareMetadata({ origin: brand && host ? `https://${host}` : defaultSiteOrigin, title, description, name, logo: brand?.logo_url }),
    title: { absolute: title },
    description,
  };
}
export default async function Home() {
  if (isShowcaseHost((await headers()).get("host") || "")) return <ProductShowcase />;
  if (!configured) redirect("/setup");
  const brand = await getBrand();
  if (!brand) redirect("/setup");
  if (!brand.public_site_enabled)
    return (
      <main className="public-disabled">
        <h1>{brand.name}</h1>
        <p>الموقع العام غير متاح حاليًا.</p>
        <Link className="button primary" href="/login">
          دخول فريق العمل
        </Link>
      </main>
    );
  const db = await createClient();
  const h = normalizeHost((await headers()).get("host") || "");
  const [catalog,website]=await Promise.all([
    db.rpc("public_catalog",{h}),db.rpc("public_website",{p_host:h}),
  ]);
  if(catalog.error || website.error)throw new Error("تعذر تحميل موقع الشركة. أعد المحاولة بعد قليل.");
  return <PublicSite brand={brand} catalog={catalog.data||[]} content={website.data?.content} areas={website.data?.areas||[]}/>;
}
