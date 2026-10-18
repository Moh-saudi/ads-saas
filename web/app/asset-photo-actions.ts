"use server";
import { requireContext } from "@/lib/data";
import { prepareAssetPhoto, storeAssetPhoto } from "@/lib/asset-photo-storage";
export type AssetPhoto = { name: string; url: string };
type Result = { ok: boolean; message: string; photos?: AssetPhoto[] };
const failure: Result = { ok: false, message: "تعذر تنفيذ العملية. تحقق من الاتصال وصلاحيات الأصل وإعداد تخزين الصور." };
async function photoContext(asset: string, writing = false) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(asset)) throw new Error("FORBIDDEN");
  const ctx = await requireContext();
  if (writing && !["admin", "area_manager", "supervisor"].includes(ctx.profile.role)) throw new Error("FORBIDDEN");
  const [parent, module] = await Promise.all([
    ctx.db.from("assets").select("id").eq("tenant_id", ctx.brand.id).eq("id", asset).single(),
    ctx.db.from("tenant_modules").select("enabled").eq("tenant_id", ctx.brand.id).eq("module_key", "assets").single(),
  ]);
  if (parent.error || !module.data?.enabled) throw new Error("FORBIDDEN");
  return { ...ctx, path: `${ctx.brand.id}/${asset}` };
}
export async function listAssetPhotos(asset: string): Promise<Result> {
  const { db, path } = await photoContext(asset);
  const names: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.storage.from("asset-photos").list(path, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) return failure;
    names.push(...data.filter((f) => f.id).map((f) => f.name));
    if (data.length < 100) break;
    if (offset >= 900) return { ok: false, message: "عدد الصور كبير جدًا؛ تواصل مع مسؤول النظام لإدارتها." };
  }
  if (!names.length) return { ok: true, message: "", photos: [] };
  const { data, error } = await db.storage.from("asset-photos").createSignedUrls(names.map((name) => `${path}/${name}`), 300);
  if (error || !data || data.some((photo) => photo.error || !photo.signedUrl)) return failure;
  return { ok: true, message: "", photos: data.flatMap((photo, i) => photo.signedUrl ? [{ name: names[i], url: photo.signedUrl }] : []) };
}
export async function uploadAssetPhoto(asset: string, form: FormData): Promise<Result> {
  const { db, brand } = await photoContext(asset, true);
  let photo;
  try { photo = await prepareAssetPhoto(form.get("image")); }
  catch (error) { return { ok: false, message: (error as Error).message }; }
  if (!photo) return { ok: false, message: "اختر صورة أولًا." };
  const { error } = await storeAssetPhoto(db, brand.id, asset, photo);
  return error ? failure : { ok: true, message: "تم رفع الصورة وربطها بالأصل." };
}
export async function deleteAssetPhoto(asset: string, name: string): Promise<Result> {
  const { db, path } = await photoContext(asset, true);
  if (!name || /[/\\\u0000-\u001f]/.test(name) || name === "." || name === "..") return failure;
  const { error } = await db.storage.from("asset-photos").remove([`${path}/${name}`]);
  return error ? failure : { ok: true, message: "تم حذف الصورة." };
}
