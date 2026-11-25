"use client";
import { useState } from 'react';
import type { CashTransaction } from '@/lib/operations-types';
import { collectionBreakdown } from '@/lib/payment-methods.mjs';
import { egp, fmt } from './ops-ui';
export function CollectionChart({rows,start,end}:{rows:CashTransaction[];start?:string;end?:string}){
 const [months,setMonths]=useState('1');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const first=new Date((end||today)+'T12:00:00Z');first.setUTCDate(1);first.setUTCMonth(first.getUTCMonth()-Number(months)+1);
 const summary=collectionBreakdown(rows,start||first.toISOString().slice(0,10),end||today);
 return <section className="card collection-card" aria-label="التحصيلات حسب طريقة الدفع">
 <header className="collection-card-head"><div><h2>التحصيلات حسب طريقة الدفع</h2><p>تحصيل الفواتير والإيرادات المباشرة، دون التحويلات الداخلية.</p></div><div className="collection-card-controls"><strong>الإجمالي: {egp(summary.total)}</strong>
 {!start&&<select aria-label="فترة التحصيل حسب الطريقة" value={months} onChange={e=>setMonths(e.target.value)}><option value="1">الشهر الحالي</option><option value="3">آخر 3 أشهر</option><option value="6">آخر 6 أشهر</option><option value="12">آخر 12 شهرًا</option></select>}
 </div></header><div className="collection-method-chart" aria-label="رسم التحصيلات حسب طريقة الدفع">
 {summary.groups.filter(g=>g.count>0).map(g=><div className="collection-method-row" key={g.id}><div><span title={g.label}>{g.id==='card'?'بطاقة بنكية':g.label}</span><small>{fmt(g.percent)}%</small></div><div className="collection-method-value"><b>{egp(g.amount)}</b><small>{g.count} عملية</small></div><div className="collection-method-track"><span style={{width:`${g.percent}%`,background:g.color}} /></div></div>)}{!summary.total&&<p>لا توجد تحصيلات خلال هذه الفترة.</p>}
 </div></section>;
}
