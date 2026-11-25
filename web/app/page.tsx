import Link from "next/link";
import { getBrand } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { configured } from "@/lib/env";
import { normalizeHost } from "@/lib/host";
import { headers } from "next/headers";
import { PublicSite } from "@/components/public-site";
import { demoData, demoBrand } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  try {
    const brand = await getBrand();
    return {
      title: brand?.website_title || brand?.name || "منصة إدارة اللافتات الذكية",
      description: brand?.website_description || "",
    };
  } catch {
    return {
      title: demoBrand.website_title || demoBrand.name,
      description: demoBrand.website_description || "",
    };
  }
}

function renderDemoFallback() {
  const d = demoData();
  return (
    <PublicSite
      brand={d.brand}
      demo
      areas={d.districts.map((area) => area.name)}
      catalog={d.assets.slice(0, 6).map((a) => ({
        code: a.code,
        street: a.street_name,
        category: a.type_name,
        length_m: a.length_m,
        width_m: a.width_m,
        faces: a.faces,
      }))}
    />
  );
}

export default async function Home() {
  if (!configured) {
    return renderDemoFallback();
  }

  try {
    const brand = (await getBrand()) || demoBrand;
    if (!brand.public_site_enabled) {
      return (
        <main className="public-disabled">
          <h1>{brand.name}</h1>
          <p>الموقع العام غير متاح حاليًا.</p>
          <Link className="button primary" href="/login">
            دخول فريق العمل
          </Link>
        </main>
      );
    }

    const db = await createClient();
    const h = normalizeHost((await headers()).get("host") || "");
    const [catalog, website] = await Promise.all([
      db.rpc("public_catalog", { h }),
      db.rpc("public_website", { p_host: h }),
    ]);

    if (catalog.error || website.error) {
      console.warn("Supabase public site query error, rendering demo fallback:", catalog.error || website.error);
      return renderDemoFallback();
    }

    return (
      <PublicSite
        brand={brand}
        catalog={catalog.data || []}
        content={website.data?.content}
        areas={website.data?.areas || []}
      />
    );
  } catch (err) {
    console.warn("Supabase connection error on Home page, rendering demo fallback:", err);
    return renderDemoFallback();
  }
}
