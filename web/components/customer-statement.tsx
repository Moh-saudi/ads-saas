"use client";
import Link from 'next/link';
import { useState } from 'react';
import type { WorkspaceData } from '@/lib/types';
import { GridTable, egp, date } from './ops-ui';
import { cairoDay } from '@/lib/license-periods.mjs';
import { paymentMethodLabel } from '@/lib/payment-methods.mjs';
export function CustomerStatement({data:d}:{data:WorkspaceData}) {
 const [party,setParty]=useState('');
 const invoices=d.finance.filter(f=>f.direction==='receivable'&&f.party_id===party).sort((a,b)=>a.due_date.localeCompare(b.due_date));
 const receipts=d.operations.payments.filter(p=>invoices.some(f=>f.id===p.invoice_id)).sort((a,b)=>a.paid_on.localeCompare(b.paid_on)||a.id.localeCompare(b.id));
 const billed=invoices.reduce((s,f)=>s+Number(f.amount),0),paid=invoices.reduce((s,f)=>s+Number(f.paid),0),overdue=invoices.filter(f=>f.due_date<cairoDay()).reduce((s,f)=>s+Math.max(0,Number(f.amount)-Number(f.paid)),0);
 return <section className="card padded" aria-label="كشف حساب العميل"><h2>كشف حساب العميل والتحصيلات</h2><label>اختر العميل<select aria-label="العميل لكشف الحساب" value={party} onChange={e=>setParty(e.target.value)}><option value="">اختر العميل</option>{d.parties.filter(p=>p.type==='advertiser').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 {party&&<><div className="notice">إجمالي الفواتير: {egp(billed)} · المحصل: {egp(paid)} · المتبقي: {egp(billed-paid)} · المتأخر: {egp(overdue)}</div>
 <GridTable columns={['الفاتورة','الاستحقاق','القيمة','المحصل','المتبقي']} rows={invoices.map(f=>[f.ref_no,date(f.due_date),egp(f.amount),egp(f.paid),egp(Number(f.amount)-Number(f.paid))])}/>
 <h3>سندات التحصيل</h3><GridTable columns={['التاريخ','الفاتورة','الطريقة','المرجع','القيمة','السند']} rows={receipts.map(p=>[date(p.paid_on),invoices.find(f=>f.id===p.invoice_id)?.ref_no,paymentMethodLabel(p.payment_method),p.reference||'—',egp(p.amount),<Link key={p.id} target="_blank" href={`${d.demo?'/demo-receipt':'/app/receipts'}/${p.id}`}>عرض / طباعة</Link>])}/></>}
 </section>;
}
