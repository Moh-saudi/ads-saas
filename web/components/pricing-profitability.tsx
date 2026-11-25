"use client";
import { useState } from 'react';
import type { WorkspaceData } from '@/lib/types';
import { DataForm } from './forms';
import { Field, Pick, GridTable, egp, fmt, exportCsv } from './ops-ui';
import { cairoDay } from '@/lib/license-periods.mjs';
import { assetPeriodResult } from '@/lib/asset-results.mjs';
export function PricingPanel({data:d}:{data:WorkspaceData}) {
 const canEdit=['admin','area_manager'].includes(d.profile.role);
 return <section className="card padded"><h2>أسعار الإعلان حسب المنطقة ونوع اللوحة</h2><p>أسعار استرشادية لفترة محددة؛ السعر النهائي يُحفظ لكل لوحة داخل عقد المعلن.</p>
 <GridTable columns={['المنطقة','نوع اللوحة','الشهري','من','إلى']} rows={d.operations.pricingRules.map(r=>[d.districts.find(x=>x.id===r.district_id)?.name,d.assetTypes.find(x=>x.id===r.type_id)?.name,egp(r.monthly_price),r.valid_from,r.valid_to])}/>
 {canEdit&&<details><summary>إضافة سعر لفترة جديدة</summary><DataForm kind="pricing_rule" demo={d.demo}><Pick name="district_id" label="المنطقة" options={d.districts}/><Pick name="type_id" label="نوع اللوحة" options={d.assetTypes}/><Field name="monthly_price" label="السعر الشهري (ج.م)" type="number" min="0"/><div className="form-grid"><Field name="valid_from" label="يبدأ من" type="date"/><Field name="valid_to" label="ينتهي في" type="date"/></div></DataForm></details>}
 </section>;
}
export function AssetProfitability({data:d}:{data:WorkspaceData}) {
 const today=cairoDay(),[start,setStart]=useState(today.slice(0,7)+'-01'),[end,setEnd]=useState(today);
 if(!['admin','accounts','accountant'].includes(d.profile.role))return null;
 const valid=start&&end&&end>=start;
 const rows=valid?d.assets.map(a=>({a,...assetPeriodResult(d,a,start,end)})).sort((a,b)=>b.result-a.result):[];
 const headings=['اللوحة / الشارع','الإشغال %','إيراد تعاقدي','حق الاستغلال','صافي الخامات','مصروفات تشغيل','إهلاك تقديري','النتيجة التقديرية','مراجعة البيانات'];
 const values=rows.map(r=>[`${r.a.code} · ${r.a.street_name}`,fmt(r.occupancy),egp(r.revenue),egp(r.concession),egp(r.materials),egp(r.expenses),egp(r.depreciation),egp(r.result),r.a.cost==null||!r.a.install_date||!r.a.useful_life_months?"بيانات الإهلاك ناقصة":"راجع اكتمال مصروفات التشغيل"]);
 return <section className="card padded" aria-label="ربحية اللوحات"><h2>إشغال اللوحات والنتيجة التقديرية</h2><div className="form-grid"><label>من<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>إلى<input type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
 <p>الإيراد وفق مدة العقود بسعر الشهر ÷ ٣٠ يومًا، وليس التحصيل النقدي. النتيجة بعد حق الاستغلال والمعدات المصروفة ومصروفات التشغيل المسجلة والإهلاك التقديري؛ قبل الضرائب والمصروفات العامة غير الموزعة. لا تسجل تكلفة اقتناء اللوحة مرة أخرى كمصروف تشغيل.</p>
 {!valid?<div className="notice danger">اختر فترة صحيحة.</div>:<><button className="button secondary" onClick={()=>exportCsv('asset-profitability',headings,values)}>تصدير التقرير</button><GridTable columns={headings} rows={values}/></>}
 </section>;
}
