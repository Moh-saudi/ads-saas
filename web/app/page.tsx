import { redirect } from "next/navigation";
import Link from "next/link";
import { getBrand } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { configured } from "@/lib/env";
import { normalizeHost } from "@/lib/host";
import { headers } from "next/headers";
import { PublicSite } from "@/components/public-site";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const brand = await getBrand();
  return {
    title: brand?.website_title || brand?.name || "منصة إدارة اللافتات الذكية",
    description: brand?.website_description || "",
  };
}
export default async function Home() {
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
  const { data, error } = await db.rpc("public_catalog", { h });
  if (error) throw new Error("تعذر تحميل دليل المواقع.");
  return <PublicSite brand={brand} catalog={data || []} />;
}
