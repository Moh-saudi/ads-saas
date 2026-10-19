import { notFound } from "next/navigation";
import { requireContext } from "@/lib/data";
import { InvoiceDocument } from "@/components/invoice-document";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    { db, brand } = await requireContext();
  const { data: invoice, error } = await db
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", brand.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!invoice) notFound();
  const [party, lines, payments] = await Promise.all([
    db
      .from("parties")
      .select("*")
      .eq("id", invoice.party_id)
      .eq("tenant_id", brand.id)
      .single(),
    db
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", id)
      .eq("tenant_id", brand.id)
      .order("id"),
    db
      .from("payments")
      .select("*")
      .eq("invoice_id", id)
      .eq("tenant_id", brand.id)
      .order("paid_on"),
  ]);
  for (const r of [party, lines, payments])
    if (r.error) throw new Error(r.error.message);
  return (
    <InvoiceDocument
      brand={brand}
      party={party.data || undefined}
      invoice={{
        ...invoice,
        lines: lines.data || [],
        payments: payments.data || [],
      }}
    />
  );
}
