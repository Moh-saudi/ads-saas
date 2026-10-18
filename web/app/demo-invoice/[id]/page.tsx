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
      brand={d.brand}
      party={d.parties.find((p) => p.id === f.party_id)}
      invoice={{
        ...f,
        issue_date: new Date().toISOString().slice(0, 10),
        net_total: f.amount,
        tax_total: 0,
        lines: [
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
        payments: f.paid
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
