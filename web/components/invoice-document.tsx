"use client";
import { paymentMethodLabel } from "@/lib/payment-methods.mjs";
import { Printer } from "lucide-react";
import type { Brand, Party } from "@/lib/types";
import { fmt, egp, date } from "./ops-ui";
export type InvoiceDocumentData = {
  id: string;
  ref_no: string;
  issue_date: string;
  due_date: string;
  direction: string;
  amount: number;
  net_total: number | null;
  tax_total: number;
  lines: {
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    net_amount: number;
    tax_rate: number;
    tax_amount: number;
  }[];
  payments: { payment_method?: string | null; amount: number; paid_on: string; reference: string | null }[];
};
export function InvoiceDocument({
  brand,
  party,
  invoice: i,
  demo = false,
}: {
  brand: Brand;
  party: Party | undefined;
  invoice: InvoiceDocumentData;
  demo?: boolean;
}) {
  const paid = i.payments.reduce((s, p) => s + Number(p.amount), 0);
  return (
    <main className="invoice-document">
      <div className="invoice-actions">
        <span>
          {demo ? "معاينة مستند ببيانات تجريبية" : "مستند من حساب الشركة"}
        </span>
        <button className="button primary" onClick={() => window.print()}>
          <Printer size={17} />
          طباعة / حفظ PDF
        </button>
      </div>
      <article className="invoice-sheet">
        <header className="invoice-brand">
          <div>
            <img className="invoice-logo" src={brand.logo_url || "/media/brand/mesk-vlab-logo.png"} alt={brand.logo_url ? brand.name : "Mesk | vlab Ai"} />
            <h1>{brand.name}</h1>
            <p>{brand.address}</p>
            <p dir="ltr">
              {brand.contact_phone} {brand.contact_email}
            </p>
          </div>
          <div>
            <span className="invoice-kicker">INVOICE · فاتورة</span>
            <h2>
              {i.direction === "receivable"
                ? "فاتورة إعلانات"
                : "مستحقات المورد أو الجهة"}
            </h2>
            <b className="code">{i.ref_no}</b>
            <p>الإصدار: {date(i.issue_date)}</p>
            <p>الاستحقاق: {date(i.due_date)}</p>
          </div>
        </header>
        <section className="invoice-party">
          <h3>
            {i.direction === "receivable" ? "إلى المعلن" : "الطرف المستحق"}
          </h3>
          <strong>{party?.name || "—"}</strong>
          <p>هاتف: {party?.phone || "—"}</p>
          {party?.tax_no && <p>الرقم الضريبي: {party.tax_no}</p>}
        </section>
        <div className="invoice-table-wrap">
          <p className="invoice-table-caption">تفاصيل البنود <span>جميع المبالغ بالجنيه المصري (EGP)</span></p>
          <table className="invoice-items">
            <colgroup><col style={{width:"31%"}} /><col style={{width:"7%"}} /><col style={{width:"13%"}} /><col style={{width:"10%"}} /><col style={{width:"13%"}} /><col style={{width:"12%"}} /><col style={{width:"14%"}} /></colgroup>
            <thead>
              <tr>
                {[
                  "البيان",
                  "الكمية",
                  "سعر الوحدة",
                  "الخصم",
                  "الصافي",
                  "الضريبة",
                  "الإجمالي",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(i.lines.length
                ? i.lines
                : [
                    {
                      description: "قيمة المستند",
                      quantity: 1,
                      unit_price: Number(i.net_total ?? i.amount),
                      discount: 0,
                      net_amount: Number(i.net_total ?? i.amount),
                      tax_rate: 0,
                      tax_amount: Number(i.tax_total || 0),
                    },
                  ]
              ).map((l, n) => (
                <tr key={n}>
                  <td className="invoice-description"><span className="invoice-row-number">{String(n+1).padStart(2,"0")}</span>{l.description}</td>
                  <td>{fmt(l.quantity)}</td>
                  <td>{fmt(l.unit_price)}</td>
                  <td>{fmt(l.discount)}</td>
                  <td>{fmt(l.net_amount)}</td>
                  <td>
                    {fmt(l.tax_amount)} <small>({fmt(l.tax_rate)}٪)</small>
                  </td>
                  <td>{fmt(Number(l.net_amount) + Number(l.tax_amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="invoice-summary">
          <div>
            <span>قبل الضريبة</span>
            <b>{egp(i.net_total ?? i.amount)}</b>
          </div>
          <div>
            <span>الضريبة</span>
            <b>{egp(i.tax_total)}</b>
          </div>
          <div className="grand-total">
            <span>الإجمالي</span>
            <b>{egp(i.amount)}</b>
          </div>
          <div>
            <span>المدفوع</span>
            <b>{egp(paid)}</b>
          </div>
          <div>
            <span>المتبقي</span>
            <b>{egp(Number(i.amount) - paid)}</b>
          </div>
        </section>
        {i.payments.length > 0 && (
          <section className="invoice-payments">
            <h3>الدفعات المسجلة</h3>
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المرجع</th>
                  <th>طريقة الدفع</th>
                  <th>القيمة</th>
                </tr>
              </thead>
              <tbody>
                {i.payments.map((p, n) => (
                  <tr key={n}>
                    <td>{date(p.paid_on)}</td>
                    <td>{p.reference || "—"}</td>
                    <td>{paymentMethodLabel(p.payment_method)}</td>
                    <td>{egp(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <section className="invoice-signatures"><div>إعداد الفاتورة<span>الاسم / التوقيع</span></div><div>اعتماد الشركة<span>التوقيع / الختم</span></div></section>
        <footer>
          مستند حسابي صادر من نظام {brand.name}. لا يتضمن اعتمادًا من منظومة
          الفاتورة الإلكترونية أو إيصالًا ضريبيًا حكوميًا.
          {demo ? " جميع البيانات تجريبية." : ""}
        </footer>
      </article>
    </main>
  );
}
