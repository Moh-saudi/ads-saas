import {notFound} from 'next/navigation';
import {loadWorkspace} from '@/lib/data';
import {ReceiptDocument} from '@/components/receipt-document';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;const d=await loadWorkspace();
 const receipt=d.operations.payments.find(p=>p.id===id);
 if(!receipt||!d.finance.some(f=>f.id===receipt.invoice_id))notFound();
 const invoice=d.finance.find(f=>f.id===receipt.invoice_id);if(!invoice)notFound();
 return <ReceiptDocument brand={d.brand} party={d.parties.find(p=>p.id===invoice.party_id)} invoice={invoice} receipt={receipt} cashAccountName={d.operations.cashAccounts.find(c=>c.id===receipt.cash_account_id)?.name} demo={d.demo}/>;
}
