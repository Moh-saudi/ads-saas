"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { listAssetPhotos, uploadAssetPhoto, deleteAssetPhoto, type AssetPhoto } from "@/app/asset-photo-actions";
export function AssetPhotos({ asset, canEdit, demo }: { asset: string; canEdit: boolean; demo: boolean }) {
  const [photos, setPhotos] = useState<AssetPhoto[]>([]), [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false), [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const refresh = useCallback(async () => {
    const result = await listAssetPhotos(asset);
    if (result.ok) { setPhotos(result.photos || []); setLoaded(true); }
    else { setMessage(result.message); setLoaded(false); }
  }, [asset]);
  const run = (fn: () => Promise<void>) => start(async () => {
    try { await fn(); } catch { setMessage("تعذر تحميل الصور أو حفظها. تحقق من الاتصال والصلاحيات وأعد المحاولة."); }
  });
  useEffect(() => {
    if (demo) return;
    let active = true;
    start(async () => {
      try {
        const result = await listAssetPhotos(asset);
        if (!active) return;
        setLoaded(result.ok);
        if (result.ok) setPhotos(result.photos || []); else setMessage(result.message);
      } catch { if (active) setMessage("تعذر تحميل صور الأصل. تحقق من الاتصال وإعداد التخزين."); }
    });
    return () => { active = false; };
  }, [asset, demo]);
  return <section className="asset-section asset-photos"><h3>صور الموقع والأصل</h3>
    <p className="subtle">صور خاصة بالشركة؛ روابط العرض مؤقتة لمدة 5 دقائق. حدّث المعرض إذا انتهت صلاحيتها.</p>
    {demo ? <p className="notice">يمكن رفع الصور في مساحة العمل الفعلية؛ الرفع معطل في العرض التجريبي.</p> : <>
      {message && <p role="status" className="notice">{message}</p>}
      {pending && <p role="status">جارٍ تنفيذ العملية…</p>}
      <button type="button" className="button secondary" disabled={pending} onClick={() => run(refresh)}>تحديث الصور</button>
      {loaded && !photos.length && <p>لم تُرفع صور لهذا الأصل بعد.</p>}
      <div className="asset-photo-grid">{photos.map((photo, i) => <figure key={photo.name}>
        <a href={photo.url} target="_blank" rel="noopener noreferrer"><img src={photo.url} alt={`صورة الأصل ${i + 1}`} loading="lazy" /></a>
        <figcaption>صورة {i + 1} {canEdit && <button type="button" className="text-button" disabled={pending} onClick={() => {
          if (!window.confirm("حذف هذه الصورة نهائيًا؟")) return;
          run(async () => { const result = await deleteAssetPhoto(asset, photo.name); setMessage(result.message); if (result.ok) await refresh(); });
        }}>حذف</button>}</figcaption>
      </figure>)}</div>
      {canEdit && <form ref={form} className="data-form" onSubmit={(event) => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        run(async () => { const result = await uploadAssetPhoto(asset, data); setMessage(result.message); if (result.ok) { form.current?.reset(); await refresh(); } });
      }}><label>إضافة صورة<input type="file" name="image" accept="image/png,image/jpeg,image/webp" required disabled={pending} /></label>
        <small>PNG / JPEG / WebP حتى 2 ميجابايت للصورة. يمكنك إضافة صور أخرى بعد كل رفع.</small>
        <button className="button primary" disabled={pending}>رفع الصورة</button>
      </form>}
    </>}
  </section>;
}
