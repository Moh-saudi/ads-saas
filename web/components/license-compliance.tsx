"use client";
import type { WorkspaceData } from '@/lib/types';
import { cairoDay, licenseCovers } from '@/lib/license-periods.mjs';
export function LicenseCompliance({data:d}:{data:WorkspaceData}) {
 const today=cairoDay();
 const missing=d.operations.contractLines.filter(l=>l.status==='active' && l.end_date>=today && !licenseCovers(d.licenses,l.asset_id,l.start_date,l.end_date));
 return <section className="card padded" aria-label="مراجعة صلاحية تصاريح الحجوزات">
  <h2>صلاحية تصاريح الحجوزات</h2>
  <p>العقود الجديدة تحتاج تصريحًا يغطي المدة كاملة. أضف تصريح التجديد قبل انتهاء القديم؛ التصاريح المتتابعة دون فجوة تغطي الحملة معًا. العقود القديمة لا تُلغى تلقائيًا.</p>
  {missing.length ? <><div className="notice danger">{missing.length} بند حجز قائم أو مستقبلي يحتاج استكمال بيانات التصريح أو تجديده.</div><ul>{missing.map(l=><li key={l.id}>{d.assets.find(a=>a.id===l.asset_id)?.code} · {d.contracts.find(c=>c.id===l.contract_id)?.ref_no} · من {l.start_date} إلى {l.end_date}</li>)}</ul></> : <div className="notice success">لا توجد فجوات في تصاريح الحجوزات المسجلة الظاهرة ضمن صلاحياتك.</div>}
 </section>;
}
