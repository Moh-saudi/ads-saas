import assert from 'node:assert/strict';
import {collectionBreakdown} from '../web/lib/payment-methods.mjs';
export async function testCollectionMethods({sql,as,ok,rejects,admin,viewer,other,t1,p1}){
 await as(admin);
 const cash=(await sql(`select id from cash_accounts where tenant_id='${t1}' and kind='cash' limit 1`)).rows[0].id;
 const inv=(await sql(`select create_itemized_invoice('${p1}','receivable','METHOD-TEST',current_date,current_date+30,null,null,'[{"description":"Test","quantity":1,"unit_price":300,"discount":0,"tax_rate":0}]') id`)).rows[0].id;
 await ok('method stored on payment and matching cash posting without duplicate ledger entry',async()=>{
  const id=(await sql(`select record_invoice_payment_with_method('${inv}',100,current_date,'IP-001','${cash}','instapay') id`)).rows[0].id;
  const r=(await sql(`select p.payment_method,c.payment_method as cash_method,p.amount,c.amount as cash_amount from payments p join cash_transactions c on c.journal_entry_id=p.journal_entry_id where p.id='${id}'`)).rows;
  assert.equal(r.length,1);assert.equal(r[0].payment_method,'instapay');assert.equal(r[0].cash_method,'instapay');assert.equal(Number(r[0].cash_amount),100);
 });
 await rejects('invalid payment method rejected',`select record_invoice_payment_with_method('${inv}',10,current_date,'X','${cash}','made_up')`,/PAYMENT_METHOD_REQUIRED/);
 await rejects('overpayment remains blocked with method',`select record_invoice_payment_with_method('${inv}',9999,current_date,'X','${cash}','card')`,/INVALID_PAYMENT/);
 await ok('legacy API stays available and method remains unknown',async()=>{
  const r=(await sql(`select record_invoice_payment('${inv}',10,current_date,'OLD','${cash}') id`)).rows[0];
  assert.equal((await sql(`select payment_method from payments where id='${r.id}'`)).rows[0].payment_method,'unknown');
 });
 await ok('direct cash income stores method and keeps journal balanced',async()=>{
  const category=(await sql(`select id from ledger_accounts where tenant_id='${t1}' and code='4000'`)).rows[0].id;
  const id=(await sql(`select create_cash_transaction_with_method('income','METHOD-DIRECT','${cash}',null,'${category}',25,current_date,'Direct income',null,null,'vodafone_cash') id`)).rows[0].id;
  const row=(await sql(`select payment_method,journal_entry_id from cash_transactions where id='${id}'`)).rows[0];assert.equal(row.payment_method,'vodafone_cash');
  assert.equal(Number((await sql(`select sum(debit-credit) n from journal_lines where entry_id='${row.journal_entry_id}'`)).rows[0].n),0);
 });
 await as(viewer);await rejects('viewer cannot record method payment',`select record_invoice_payment_with_method('${inv}',10,current_date,'X','${cash}','cash')`,/FORBIDDEN/);
 await as(other);await rejects('another tenant cannot pay invoice',`select record_invoice_payment_with_method('${inv}',10,current_date,'X','${cash}','cash')`,/INVOICE_NOT_FOUND|FORBIDDEN/);
 await as(admin);
 await ok('chart counts inflows once, respects dates, retains unknown and excludes transfers/outflows',async()=>{
 const rows=[{kind:'receipt',amount:100,payment_method:'instapay',transaction_date:'2026-10-01'},{kind:'income',amount:20,transaction_date:'2026-10-19'},...['expense','transfer','opening','payment','salary'].map(kind=>({kind,amount:999,transaction_date:'2026-10-10'})),{kind:'receipt',amount:999,transaction_date:'2026-09-30'},{kind:'receipt',amount:999,transaction_date:'2026-10-20'}];
 const r=collectionBreakdown(rows,'2026-10-01','2026-10-19');assert.equal(r.total,120);assert.equal(r.groups.find(g=>g.id==='unknown').amount,20);assert.equal(r.groups.find(g=>g.id==='instapay').count,1);
 });
}
