"use client";
import type { Brand, Party, FinanceRow } from '@/lib/types';
import type { Receipt } from '@/lib/operations-types';
import { egp,date } from './ops-ui';
import { paymentMethodLabel } from '@/lib/payment-methods.mjs';
export function ReceiptDocument({brand,party,invoice,receipt:p,cashAccountName,demo=false}:{brand:Brand;party?:Party;invoice:FinanceRow;receipt:Receipt;cashAccountName?:string;demo?:boolean}) {
 return <main className="invoice-document"><div className="invoice-actions"><span>{demo?'سند تجريبي — ليس إثبات تحصيل فعلي':'سند مسجل من حساب الشركة'}</span><button className="button primary" onClick={()=>window.print()}>طباعة / حفظ PDF</button></div><article className="invoice-sheet">
 <header className="invoice-brand"><div><img className="invoice-logo" src={brand.logo_url||'/media/brand/mesk-vlab-logo.png'} alt={brand.name}/><h1>{brand.name}</h1><p>{brand.address}</p></div><div><h2>{invoice?.direction==='payable'?'سند صرف':'سند قبض'}</h2><span className="code">{p.id}</span><p>{date(p.paid_on)}</p></div></header>
 <section className="invoice-party"><h3>{invoice?.direction==='payable'?'صُرف إلى':'استلمنا من'}: {party?.name||'—'}</h3><p>عن الفاتورة: {invoice?.ref_no} · قيمة الحركة: <strong>{egp(p.amount)}</strong></p></section>
 <table><tbody><tr><th>طريقة التحصيل / الدفع</th><td>{paymentMethodLabel(p.payment_method)}</td></tr><tr><th>مرجع التحويل / الإيصال</th><td>{p.reference||'غير مسجل'}</td></tr><tr><th>الخزينة / البنك</th><td>{cashAccountName||'راجع سجل التحصيل'}</td></tr></tbody></table>
 <p className="subtle">السند يوثق الحركة المسجلة بالنظام. مرجع التحويل يُراجع مع كشف البنك أو المحفظة.</p><div className="receipt-signatures"><p>توقيع المستلم: __________________</p><p>توقيع المحاسب: __________________</p></div>
 </article></main>;
}
