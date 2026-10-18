import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assetImageFormat, maxAssetImageBytes } from "./asset-images.mjs";
export async function prepareAssetPhoto(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || !value.size) return null;
  if (value.size > maxAssetImageBytes) throw new Error("الصورة يجب ألا تتجاوز 2 ميجابايت.");
  const bytes = new Uint8Array(await value.arrayBuffer());
  try { return { bytes, ...assetImageFormat(bytes) }; }
  catch { throw new Error("اختر صورة حقيقية بصيغة PNG أو JPEG أو WebP."); }
}
export async function storeAssetPhoto(db: SupabaseClient, tenant: string, asset: string, photo: NonNullable<Awaited<ReturnType<typeof prepareAssetPhoto>>>) {
  return db.storage.from("asset-photos").upload(`${tenant}/${asset}/${crypto.randomUUID()}.${photo.extension}`, photo.bytes, { contentType: photo.mime, upsert: false });
}
