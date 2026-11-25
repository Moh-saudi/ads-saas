import assert from 'node:assert/strict';
import {licenseCovers} from '../web/lib/license-periods.mjs';
import {assetPeriodResult,overlapDays} from '../web/lib/asset-results.mjs';
export async function testBusinessJourney({sql,as,ok,rejects,admin,manager,other,t1,a1,a2,p1,d1,d2,ty1}) {
 await as(admin);
 const supplier=(await sql(`select id from parties where tenant_id='${t1}' and type='supplier' limit 1`)).rows[0].id;
 const warehouse=(await sql(`select id from warehouses where tenant_id='${t1}' and code='WH1'`)).rows[0].id;
 const item=(await sql(`insert into inventory_items(tenant_id,sku,name,length_m,width_m,material) values('${t1}','JOURNEY-ITEM','Manufactured frame',6,3,'Galvanized steel') returning id`)).rows[0].id;
 const work=(await sql(`insert into work_orders(tenant_id,ref_no,asset_id,title,kind,planned_start,due_date,created_by) values('${t1}','JOURNEY-WORK','${a1}','Install frame','installation',current_date,current_date+3,'${admin}') returning id`)).rows[0].id;
 let purchase;
 await ok('linked outsourced manufacturing request preserves billboard work and specification',async()=>{
  purchase=(await sql(`select create_asset_purchase('JOURNEY-PO','${supplier}','${warehouse}',current_date,current_date+2,'[{"item_id":"${item}","quantity":2,"unit_cost":1500}]','Manufacture to specification','${a1}','${work}','external_manufacture') id`)).rows[0].id;
  const row=(await sql(`select * from purchase_orders where id='${purchase}'`)).rows[0];assert.equal(row.asset_id,a1);assert.equal(row.work_order_id,work);assert.equal(row.procurement_kind,'external_manufacture');
 });
 await rejects('procurement cannot link a work order belonging to a different billboard',`select create_asset_purchase('BAD-WORK','${supplier}','${warehouse}',current_date,null,'[{"item_id":"${item}","quantity":1,"unit_cost":100}]','Mismatch','${a2}','${work}','purchase')`,/INVALID_PROCUREMENT_WORK/);
 await ok('request does not create inventory before receipt',async()=>assert.equal((await sql(`select * from v_stock_balances where item_id='${item}'`)).rows.length,0));
 await ok('receipt and issue carry real manufacturing cost to the installation',async()=>{
  await sql(`select receive_purchase('${purchase}')`);
  const issue=(await sql(`select move_stock('issue','JOURNEY-ISSUE','${item}','${warehouse}',null,1,0,'Install manufactured frame','${a1}','${work}',null) id`)).rows[0].id;
  const row=(await sql(`select * from stock_movements where id='${issue}'`)).rows[0];assert.equal(row.asset_id,a1);assert.equal(Number(row.unit_cost),1500);assert.equal(row.work_order_id,work);
  assert.equal(Number((await sql(`select quantity from v_stock_balances where item_id='${item}'`)).rows[0].quantity),1);
 });
 await rejects('duplicate receipt remains rejected',`select receive_purchase('${purchase}')`,/PURCHASE_ALREADY_PROCESSED/);
 await ok('installation completion records initial install date',async()=>{
  await sql(`update assets set install_date=null where id='${a1}'`);
  await sql(`select progress_asset_work('${work}','in_progress',null)`);await sql(`select progress_asset_work('${work}','completed','Frame installed and checked')`);
  assert.equal((await sql(`select install_date=(now() at time zone 'Africa/Cairo')::date same from assets where id='${a1}'`)).rows[0].same,true);
 });
 await rejects('closed installation cannot acquire new procurement',`select create_asset_purchase('CLOSED-WORK','${supplier}','${warehouse}',current_date,null,'[{"item_id":"${item}","quantity":1,"unit_cost":100}]','Closed','${a1}','${work}','purchase')`,/INVALID_PROCUREMENT_WORK/);
 await ok('rate card stores distinct district type validity and price',async()=>{await sql(`insert into pricing_rules(tenant_id,district_id,type_id,monthly_price,valid_from,valid_to) values('${t1}','${d1}','${ty1}',900,current_date+60,current_date+90)`);});
 await rejects('overlapping rates for the same location and type are rejected',`insert into pricing_rules(tenant_id,district_id,type_id,monthly_price,valid_from,valid_to) values('${t1}','${d1}','${ty1}',1000,current_date+70,current_date+100)`,/conflicting key|exclusion constraint/);
 const contract=(await sql(`select create_customer_contract('${p1}','JOURNEY-CONTRACT',current_date+70,current_date+80,'[{"asset_id":"${a1}","monthly_price":900}]') id`)).rows[0].id;
 let invoice,receipt;
 await ok('licensed billboard is contracted invoiced and collected with one electronic reference',async()=>{
  invoice=(await sql(`select create_itemized_invoice('${p1}','receivable','JOURNEY-INVOICE',current_date,current_date+5,'${contract}',null,'[{"description":"Advertising campaign","quantity":1,"unit_price":330,"discount":0,"tax_rate":0}]') id`)).rows[0].id;
  const cash=(await sql(`select id from cash_accounts where tenant_id='${t1}' limit 1`)).rows[0].id;
  await rejects('electronic receipt without reference is rejected',`select record_invoice_payment_with_method('${invoice}',10,current_date,'','${cash}','instapay')`,/electronic_payment_reference/);
  receipt=(await sql(`select record_invoice_payment_with_method('${invoice}',100,current_date,'IP-JOURNEY-001','${cash}','instapay') id`)).rows[0].id;
  const row=(await sql(`select * from payments where id='${receipt}'`)).rows[0];assert.equal(row.invoice_id,invoice);assert.equal(row.reference,'IP-JOURNEY-001');assert.equal(row.payment_method,'instapay');
  assert.equal(Number((await sql(`select paid from v_invoice_balances where id='${invoice}'`)).rows[0].paid),100);
  assert.equal((await sql(`select * from payments where invoice_id='${invoice}'`)).rows.length,1);
 });
 await ok('all journey journals remain balanced',async()=>assert.equal((await sql(`select entry_id from journal_lines where tenant_id='${t1}' group by entry_id having sum(debit)<>sum(credit)`)).rows.length,0));
 await as(manager);
 await rejects('scoped manager cannot price another district',`insert into pricing_rules(tenant_id,district_id,type_id,monthly_price,valid_from,valid_to) values('${t1}','${d2}','${ty1}',900,current_date,current_date+10)`,/row-level security|FORBIDDEN/);
 await as(other);
 await ok('another tenant cannot see journey purchases receipts and rates',async()=>{for(const table of ['purchase_orders','payments','pricing_rules'])assert.equal((await sql(`select * from ${table} where tenant_id='${t1}'`)).rows.length,0);});
 await as(admin);
 await ok('frontend license coverage agrees on renewal boundaries and revoked permits',async()=>{
  const l=[{asset_id:'a',valid_from:'2026-01-01',expires_on:'2026-01-10'},{asset_id:'a',valid_from:'2026-01-11',expires_on:'2026-01-31'}];
  assert.equal(licenseCovers(l,'a','2026-01-01','2026-01-31'),true);assert.equal(licenseCovers([{...l[0],expires_on:'2026-01-09'},l[1]],'a','2026-01-01','2026-01-31'),false);assert.equal(licenseCovers(l.map(x=>({...x,status:'revoked'})),'a','2026-01-01','2026-01-31'),false);
 });
 await ok('profit report prorates inclusive days and counts acquisition receipts neither as revenue nor expense',async()=>{
  const asset={id:'a',cost:3000,install_date:'2026-01-01',useful_life_months:30};
  const data={upstream:[{id:'u',status:'active',start_date:'2026-01-01',end_date:'2026-12-31'}],operations:{contractLines:[{asset_id:'a',status:'active',monthly_price:3000,start_date:'2026-01-01',end_date:'2026-01-30'}],workOrders:[{id:'w',asset_id:'a'}],upstreamCoverage:[{asset_id:'a',upstream_contract_id:'u',monthly_cost:900,valid_from:'2026-01-01',valid_to:'2026-12-31'}],stockMoves:[{asset_id:'a',kind:'issue',quantity:2,unit_cost:100,created_at:'2026-01-10'},{asset_id:'a',kind:'return',quantity:1,unit_cost:100,created_at:'2026-01-12'},{asset_id:'a',kind:'receipt',quantity:10,unit_cost:100,created_at:'2026-01-09'}],cashTransactions:[{work_order_id:'w',kind:'expense',amount:200,transaction_date:'2026-01-10'},{asset_id:'a',kind:'transfer',amount:5000,transaction_date:'2026-01-10'}]}};
  const r=assetPeriodResult(data,asset,'2026-01-01','2026-01-30');assert.equal(r.revenue,3000);assert.equal(r.concession,900);assert.equal(r.materials,100);assert.equal(r.expenses,200);assert.equal(r.depreciation,100);assert.equal(r.result,1700);assert.equal(r.occupancy,100);assert.equal(overlapDays('2026-02-28','2026-03-01','2026-02-01','2026-02-28'),1);
 });
}
