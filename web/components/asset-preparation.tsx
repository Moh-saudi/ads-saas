"use client";
import type { Asset, WorkspaceData } from '@/lib/types';
import { GridTable, egp, date } from './ops-ui';
export function AssetPreparation({asset:a,data:d,canFinance}:{asset:Asset;data:WorkspaceData;canFinance:boolean}) {
 const o=d.operations;
 const work=o.workOrders.filter(w=>w.asset_id===a.id);
 const orders=o.purchases.filter(p=>p.asset_id===a.id || work.some(w=>w.id===p.work_order_id));
 const moves=o.stockMoves.filter(m=>m.asset_id===a.id || work.some(w=>w.id===m.work_order_id));
 const materials=moves.reduce((sum,m)=>sum+(['issue','adjustment_out'].includes(m.kind)?1:m.kind==='return'?-1:0)*Number(m.quantity)*Number(m.unit_cost),0);
 const expenses=o.cashTransactions.filter(t=>t.kind==='expense'&&(t.asset_id===a.id||work.some(w=>w.id===t.work_order_id))).reduce((s,t)=>s+Number(t.amount),0);
 return <details className="asset-section" open><summary>تجهيز اللوحة: الطلب ← الاستلام ← الصرف ← التركيب</summary>
  <p>طلب التوريد لا يعني التركيب. بعد استلام المورد، سجّل صرف المعدات من المخزن على اللوحة وأمر العمل، ثم أغلق أمر التركيب بعد التنفيذ.</p>
  <GridTable columns={['الطلب','الغرض','الاستلام','أمر العمل',...(canFinance?['قيمة الطلب']:[])]} rows={orders.map(p=>[p.ref_no,p.procurement_kind==='external_manufacture'?'تصنيع لدى المورد':'شراء',p.status==='received'?'تم الاستلام':p.status==='cancelled'?'ملغي':'بانتظار التوريد',work.find(w=>w.id===p.work_order_id)?.ref_no||'غير مربوط',...(canFinance?[egp(o.purchaseLines.filter(l=>l.purchase_id===p.id).reduce((s,l)=>s+Number(l.quantity)*Number(l.unit_cost),0))]:[])])}/>
  {canFinance && <div className="notice">صافي المعدات المصروفة: {egp(materials)} · مصروفات مسجلة على اللوحة: {egp(expenses)}. قيمة أمر الشراء لا تُضاف مرة ثانية إلى تكلفة الصرف.</div>}
  <p>تاريخ تركيب اللوحة: {date(a.install_date)}. إتمام أمر من نوع «تركيب» يسجل تاريخ التركيب إن لم يكن مسجلًا.</p>
 </details>;
}
