"use server";
import { requireContext } from "@/lib/data";
export async function uploadWebsiteImage(form:FormData):Promise<{url?:string;error?:string}> {
  const {db,brand,profile}=await requireContext();
  if(profile.role!=="admin") return {error:"رفع صور الموقع متاح لمدير الشركة فقط."};
  const file=form.get("image");
  const extensions:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
  if(!(file instanceof File) || !extensions[file.type] || !file.size || file.size>2097152)
    return {error:"اختر صورة JPG أو PNG أو WebP حتى 2 ميجابايت."};
  const bytes=new Uint8Array(await file.arrayBuffer());
  const valid=(file.type==="image/png" && bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71)
    ||(file.type==="image/jpeg" && bytes[0]===255 && bytes[1]===216 && bytes[2]===255)
    ||(file.type==="image/webp" && String.fromCharCode(...bytes.slice(0,4))==="RIFF" && String.fromCharCode(...bytes.slice(8,12))==="WEBP");
  if(!valid)return {error:"محتوى الصورة لا يطابق نوع الملف."};
  const path=`${brand.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const result=await db.storage.from("tenant-website").upload(path,bytes,{contentType:file.type,upsert:false});
  if(result.error)return {error:"تعذر رفع الصورة. تحقق من الاتصال ثم أعد المحاولة."};
  return {url:db.storage.from("tenant-website").getPublicUrl(path).data.publicUrl};
}
