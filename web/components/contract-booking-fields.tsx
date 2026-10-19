"use client";
import { useState } from 'react';
import type { WorkspaceData } from '@/lib/types';
import { licenseCovers } from '@/lib/license-periods.mjs';
import { egp } from './ops-ui';
export function ContractBookingFields({data:d}:{data:WorkspaceData}) {
 const [start,setStart]=useState(''),[end,setEnd]=useState(''),[lines,setLines]=useState<Record<string,string>>({});
 function suggested(assetId:string){const a=d.assets.find(a=>a.id===assetId),district=d.streets.find(s=>s.id===a?.street_id)?.district_id;return d.operations.pricingRules.find(r=>r.district_id===district&&r.type_id===a?.type_id&&r.valid_from<=start&&r.valid_to>=end);}
 return <>
 <div className="form-grid"><label>تاريخ البداية<input type="date" name="start_date" value={start} required onChange={e=>setStart(e.target.value)} /></label><label>تاريخ النهاية (شامل)<input type="date" name="end_date" value={end} min={start||undefined} required onChange={e=>setEnd(e.target.value)} /></label></div>
 <fieldset className="booking-assets"><legend>اللوحات والأسعار المتفق عليها</legend><p>اختر كل لوحة وحدد سعرها الشهري. السعر المقترح حسب المنطقة والنوع اختياري، ويمكن تعديله حسب الاتفاق.</p>
 {d.assets.filter(a=>!['retired','maintenance'].includes(a.live_status)).map(a=>{const selected=Object.hasOwn(lines,a.id),rate=suggested(a.id);return <div className="booking-asset" key={a.id}>
  <label className="check-label"><input type="checkbox" checked={selected} onChange={e=>setLines(old=>{const next={...old};if(e.target.checked)next[a.id]=rate?String(rate.monthly_price):'';else delete next[a.id];return next;})}/>{a.code} · {a.street_name}</label>
  {selected&&<><label>الإيجار الشهري (ج.م)<input aria-label={`سعر ${a.code}`} type="number" required min="0" step="0.01" value={lines[a.id]} onChange={e=>setLines(old=>({...old,[a.id]:e.target.value}))}/></label>
  {rate&&<button type="button" className="button secondary" onClick={()=>setLines(old=>({...old,[a.id]:String(rate.monthly_price)}))}>تطبيق المقترح: {egp(rate.monthly_price)}</button>}
  {start&&end&&<small className={licenseCovers(d.licenses,a.id,start,end)?'success':'danger'}>{licenseCovers(d.licenses,a.id,start,end)?'التصريح يغطي الفترة المختارة':'التصريح يحتاج استكمالًا أو تجديدًا لهذه الفترة'}</small>}</>}
 </div>;})}
 {!Object.keys(lines).length&&<div className="notice">اختر لوحة واحدة على الأقل. يتحقق سوبابيز من التصريح وحق الاستغلال وعدم تداخل الحجز عند الحفظ.</div>}
 <input type="hidden" name="contract_lines" value={JSON.stringify(Object.entries(lines).map(([asset_id,price])=>({asset_id,monthly_price:Number(price)})))} />
 </fieldset></>;
}
