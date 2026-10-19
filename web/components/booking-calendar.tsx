"use client";
import { useState } from 'react';
import type { WorkspaceData } from '@/lib/types';
import { cairoDay } from '@/lib/license-periods.mjs';
type Event={id:string;asset:string;start:string;end:string;kind:string;title:string};
export function BookingCalendar({data:d}:{data:WorkspaceData}) {
 const [month,setMonth]=useState(cairoDay().slice(0,7)),[asset,setAsset]=useState(''),[selected,setSelected]=useState<Event|null>(null);
 const days=/^\d{4}-\d{2}$/.test(month)?new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate():0;
 const start=month+'-01',end=month+'-'+String(days).padStart(2,'0');
 const events:Event[]=[...d.operations.contractLines.filter(l=>l.status==='active').flatMap(l=>[
  {id:l.id,asset:l.asset_id,start:l.start_date,end:l.end_date,kind:'booking',title:`حجز · ${d.contracts.find(c=>c.id===l.contract_id)?.ref_no||'عقد معلن'}`},
  {id:l.id+'-renew',asset:l.asset_id,start:l.end_date,end:l.end_date,kind:'renewal',title:'انتهاء الحملة — راجع التجديد أو الفك'},
 ]),...d.operations.workOrders.filter(w=>w.status!=='cancelled').map(w=>({id:w.id,asset:w.asset_id,start:w.planned_start||w.due_date,end:w.due_date,kind:w.kind||'maintenance',title:`${w.ref_no} · ${w.title} · ${w.status==='completed'?'مكتمل':'قيد التنفيذ'}`}))].filter(e=>e.start<=end&&e.end>=start&&(!asset||e.asset===asset));
 const assets=d.assets.filter(a=>(!asset||a.id===asset)&&events.some(e=>e.asset===a.id));
 return <section className="card padded booking-calendar" aria-label="جدول الحجوزات والتنفيذ"><h2>جدول الحجوزات والتركيب والفك</h2><div className="form-grid"><label>الشهر<input type="month" value={month} onChange={e=>{setMonth(e.target.value);setSelected(null);}}/></label><label>اللوحة<select value={asset} onChange={e=>{setAsset(e.target.value);setSelected(null);}}><option value="">كل اللوحات</option>{d.assets.map(a=><option key={a.id} value={a.id}>{a.code} · {a.street_name}</option>)}</select></label></div>
 <p>الأزرق: حجز إعلان · الأخضر: تركيب · الأحمر: فك · الرمادي: صيانة · البرتقالي: انتهاء الحملة. مواعيد التنفيذ مخططة ولا تعني إتمام العمل. اضغط على أي فترة لعرض تفاصيلها.</p>
 <div className="timeline-scroll"><div className="timeline-days" style={{gridTemplateColumns:`repeat(${days||1},minmax(28px,1fr))`}}>{Array.from({length:days},(_,i)=><span key={i}>{i+1}</span>)}</div>
 {assets.map(a=><div className="timeline-asset" key={a.id}><strong>{a.code} · {a.street_name}</strong>{events.filter(e=>e.asset===a.id).map(e=>{const first=e.start<start?1:Number(e.start.slice(8,10)),last=e.end>end?days:Number(e.end.slice(8,10));return <div className="timeline-track" key={e.id} style={{gridTemplateColumns:`repeat(${days},minmax(28px,1fr))`}}><button className={`timeline-event ${e.kind}`} style={{gridColumn:`${first} / ${last+1}`}} onClick={()=>setSelected(e)} title={`${e.title} من ${e.start} إلى ${e.end}`} aria-label={`${a.code} ${e.title} من ${e.start} إلى ${e.end}`}>{e.title}</button></div>;})}</div>)}</div>
 {!events.length&&<div className="notice">لا توجد حجوزات أو أوامر عمل في الفترة المختارة ضمن صلاحياتك.</div>}
 {selected&&<div className="notice" role="status"><strong>{selected.title}</strong><p>{d.assets.find(a=>a.id===selected.asset)?.code} · من {selected.start} إلى {selected.end}</p><button type="button" className="button secondary" onClick={()=>setSelected(null)}>إغلاق التفاصيل</button></div>}
 </section>;
}
