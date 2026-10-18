import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { configured } from "./env";
import { lookupBrand } from "./brand-lookup";
import { normalizeHost } from "./host";
import { emptyKpis, type Brand, type WorkspaceData } from "./types";
import { loadOperations, readTenantRows } from "./operations-data";
import type { WebsiteContent } from "./website-types";

export const getBrand = cache(async (): Promise<Brand | null> => {
  if (!configured) return null;
  const h = normalizeHost((await headers()).get("host") || "");
  const { data, error } = await lookupBrand(h);
  if (error)
    throw new Error("تعذر تحميل هوية الشركة. تحقق من migrations والاتصال.");
  return data?.[0] || null;
});
export const requireContext = cache(async () => {
  if (!configured) redirect("/setup");
  const brand = await getBrand();
  if (!brand) redirect("/setup");
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await db
    .from("profiles")
    .select("id,tenant_id,full_name,role,scope_district_id")
    .eq("id", user.id)
    .single();
  if (error || !profile || profile.tenant_id !== brand.id)
    redirect("/login?error=tenant");
  return { db, brand, profile, user };
});
export async function loadWorkspace(): Promise<WorkspaceData> {
  const { db, brand, profile } = await requireContext();
  const [
    operations,
    kpiResult,
    assets,
    parties,
    contracts,
    modules,
    streets,
    districts,
    governorates,
    assetTypes,
    finance,
    licenses,
    upstream,
    websiteRows,
  ] = await Promise.all([
    loadOperations(db, brand.id),
    db.from("v_kpis").select("*").eq("tenant_id", brand.id).maybeSingle(),
    readTenantRows<WorkspaceData["assets"][number]>(
      db,
      "v_asset_register",
      brand.id,
      "*",
      "code",
    ),
    readTenantRows<WorkspaceData["parties"][number]>(
      db,
      "parties",
      brand.id,
      "id,name,type,phone,whatsapp,wa_opt_in,tax_no",
      "name",
    ),
    readTenantRows<WorkspaceData["contracts"][number]>(
      db,
      "customer_contracts",
      brand.id,
      "*",
      "id",
    ),
    readTenantRows<WorkspaceData["modules"][number]>(
      db,
      "tenant_modules",
      brand.id,
      "module_key,enabled",
      "module_key",
    ),
    readTenantRows<WorkspaceData["streets"][number]>(
      db,
      "streets",
      brand.id,
      "id,name,district_id,holding",
    ),
    readTenantRows<WorkspaceData["districts"][number]>(
      db,
      "districts",
      brand.id,
      "id,name,governorate_id",
    ),
    readTenantRows<WorkspaceData["governorates"][number]>(
      db,
      "governorates",
      brand.id,
      "id,name",
    ),
    readTenantRows<WorkspaceData["assetTypes"][number]>(
      db,
      "asset_types",
      brand.id,
      "id,name",
    ),
    readTenantRows<WorkspaceData["finance"][number]>(
      db,
      "v_invoice_balances",
      brand.id,
    ),
    readTenantRows<WorkspaceData["licenses"][number]>(db, "licenses", brand.id),
    readTenantRows<WorkspaceData["upstream"][number]>(
      db,
      "upstream_contracts",
      brand.id,
    ),
    readTenantRows<{content:WebsiteContent}>(db,"tenant_website",brand.id,"content","tenant_id"),
  ]);
  if (kpiResult.error)
    throw new Error(`تعذر تحميل المؤشرات: ${kpiResult.error.message}`);
  const kpis = kpiResult.data;
  return {
    operations,
    brand,
    profile,
    demo: false,
    assets: assets || [],
    kpis: kpis || emptyKpis,
    parties: parties || [],
    contracts: contracts || [],
    modules: modules || [],
    streets: streets || [],
    districts: districts || [],
    governorates: governorates || [],
    assetTypes: assetTypes || [],
    finance: finance || [],
    licenses: licenses || [],
    upstream: upstream || [],
    website: websiteRows[0]?.content,
  } as WorkspaceData;
}
