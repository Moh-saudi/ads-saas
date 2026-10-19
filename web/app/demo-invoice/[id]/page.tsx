import { notFound } from "next/navigation";
import { demoData } from "@/lib/demo";
import { InvoiceDocument } from "@/components/invoice-document";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    d = demoData(),
    f = d.finance.find((f) => f.id === id);
  if (!f) notFound();
  return (
    <InvoiceDocument
      demo
      brand={{...d.brand, name:"ميسك — ديمو", logo_url:"/media/brand/mesk-vlab-logo.png"}}
      party={d.parties.find((p) => p.id === f.party_id)}
      invoice={{
        ...f,
        issue_date: new Date().toISOString().slice(0, 10),
        net_total: f.amount,
        tax_total: 0,
        lines: id === "f1" ? [
          {description:"إيجار لوحة إعلانية — التجمع الخامس\nحملة المعلن على الموقع MD-0105",quantity:1,unit_price:18000,discount:0,net_amount:18000,tax_rate:0,tax_amount:0},
          {description:"طباعة وتجهيز خامة الإعلان",quantity:1,unit_price:6000,discount:0,net_amount:6000,tax_rate:0,tax_amount:0},
          {description:"تركيب الخامة وفحص الموقع",quantity:1,unit_price:3000,discount:0,net_amount:3000,tax_rate:0,tax_amount:0},
        ] : [
          {
            description: "تأجير مساحات إعلانية — بيانات تجريبية",
            quantity: 1,
            unit_price: f.amount,
            discount: 0,
            net_amount: f.amount,
            tax_rate: 0,
            tax_amount: 0,
          },
        ],
        payments: id === "f1" ? d.operations.cashTransactions.filter(t=>t.ref_no.startsWith("RCPT-")).map(t=>({amount:t.amount,paid_on:t.transaction_date,reference:t.ref_no,payment_method:t.payment_method})) : f.paid
          ? [
              {
                amount: f.paid,
                paid_on: new Date().toISOString().slice(0, 10),
                reference: "دفعة تجريبية",
              },
            ]
          : [],
      }}
    />
  );
}
