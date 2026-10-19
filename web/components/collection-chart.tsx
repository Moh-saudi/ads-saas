"use client";
import { useState } from 'react';
import type { CashTransaction } from '@/lib/operations-types';
import { collectionBreakdown } from '@/lib/payment-methods.mjs';
import { Panel, egp, fmt } from './ops-ui';
export function CollectionChart({rows,start,end}:{rows:CashTransaction[];start?:string;end?:string}){
 const [months,setMonths]=useState('1');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const first=new Date((end||today)+'T12:00:00Z');first.setUTCDate(1);first.setUTCMonth(first.getUTCMonth()-Number(months)+1);
 const summary=collectionBreakdown(rows,start||first.toISOString().slice(0,10),end||today);
 return <Panel title="التحصيلات حسب طريقة الدفع" subtitle="تحصيل الفواتير والإيرادات المباشرة خلال الفترة المختارة؛ بدون المصروفات أو التحويلات بين حسابات الشركة."><div className="collection-method-chart" aria-label="رسم التحصيلات حسب طريقة الدفع">
 {!start&&<label>فترة التحصيل<select aria-label="فترة التحصيل حسب الطريقة" value={months} onChange={e=>setMonths(e.target.value)}><option value="1">الشهر الحالي</option><option value="3">آخر 3 أشهر</option><option value="6">آخر 6 أشهر</option><option value="12">آخر 12 شهرًا</option></select></label>}
 <strong>إجمالي التحصيلات: {egp(summary.total)}</strong>{summary.groups.filter(g=>g.count>0).map(g=><div className="collection-method-row" key={g.id}><div><span>{g.label}</span><b>{egp(g.amount)} · {fmt(g.percent)}%</b></div><div className="collection-method-track"><span style={{width:`${g.percent}%`,background:g.color}} /></div><small>{g.count} عملية</small></div>)}{!summary.total&&<p>لا توجد تحصيلات خلال هذه الفترة.</p>}
 </div></Panel>;
}
