import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInThisContext} from 'node:vm';
const requireWeb=createRequire(new URL('../web/package.json',import.meta.url));
const ts=requireWeb('typescript');
const cache=new Map();
function load(name){
 if(cache.has(name))return cache.get(name);
 const exports={};cache.set(name,exports);
 const source=readFileSync(new URL(`../web/lib/${name}.ts`,import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInThisContext(`(function(exports,require){${js}\n})`)(exports,id=>id.startsWith('./')?load(id.slice(2)):requireWeb(id));
 return exports;
}
const d=load('demo').demoData(),o=d.operations;
assert.equal(d.demo,true);
for(const [key,rows] of Object.entries(o))assert.ok(rows.length>0,`${key} must have demo rows`);
for(const key of ['assets','parties','contracts','streets','districts','governorates','assetTypes','finance','licenses','upstream'])assert.ok(d[key].length>0,key);
const has=(rows,id)=>rows.some(r=>r.id===id);
for(const a of d.assets){
 assert.ok(has(d.streets,a.street_id));
 assert.ok(d.licenses.some(l=>l.asset_id===a.id));
 const lines=o.contractLines.filter(l=>l.asset_id===a.id);
 assert.equal(lines.length,a.monthly_price==null?0:1);
 if(lines.length){assert.equal(lines[0].monthly_price,a.monthly_price);assert.equal(lines[0].end_date,a.lease_end);}
}
for(const c of d.contracts){
 const lines=o.contractLines.filter(l=>l.contract_id===c.id);assert.ok(lines.length);
 assert.ok(has(d.parties,c.customer_id));
 let total=0;
 for(const l of lines){assert.ok(l.start_date>=c.start_date&&l.end_date<=c.end_date);total+=Math.round(l.monthly_price*((Date.parse(l.end_date)-Date.parse(l.start_date))/86400000+1)/30*100);}
 assert.equal(c.total_value,total/100);
}
for(const f of d.finance){assert.ok(has(d.parties,f.party_id));assert.ok(f.paid<=f.amount);}
for(const l of o.installments){assert.ok(has(d.parties,l.party_id));assert.ok(has(l.customer_contract_id?d.contracts:d.upstream,l.customer_contract_id||l.upstream_contract_id));}
for(const p of o.purchases){assert.ok(has(d.parties,p.supplier_id));assert.ok(has(o.warehouses,p.warehouse_id));assert.ok(o.purchaseLines.some(l=>l.purchase_id===p.id));}
for(const p of o.purchaseLines){assert.ok(has(o.items,p.item_id));assert.ok(has(o.purchases,p.purchase_id));}
for(const b of o.stockBalances){
 const qty=o.stockMoves.filter(m=>m.item_id===b.item_id).reduce((n,m)=>n+(m.to_warehouse_id===b.warehouse_id?m.quantity:0)-(m.from_warehouse_id===b.warehouse_id?m.quantity:0),0);
 assert.equal(b.quantity,qty);assert.equal(b.inventory_value,b.quantity*b.average_cost);
}
for(const w of o.workOrders){assert.ok(has(d.assets,w.asset_id));assert.ok(has(o.employees,w.assigned_employee_id));}
for(const row of [...o.attendance,...o.leaves,...o.payroll])assert.ok(has(o.employees,row.employee_id));
for(const e of o.employees)assert.ok(has(o.tenantUsers,e.profile_id));
for(const a of o.audit)assert.ok(has(o.tenantUsers,a.actor_id));
for(const j of o.journals){const lines=o.journalLines.filter(l=>l.entry_id===j.id);assert.ok(lines.length>=2);assert.equal(lines.reduce((s,l)=>s+l.debit-l.credit,0),0);}
assert.equal(o.trialBalance.reduce((n,r)=>n+r.debit-r.credit,0),0);
assert.equal(d.kpis.monthly_revenue,d.assets.reduce((n,a)=>n+(a.monthly_price||0),0));
assert.equal(d.kpis.leased,o.contractLines.length);
console.log(`Demo integrity passed: ${d.assets.length} assets, ${o.contractLines.length} contract lines, ${d.licenses.length} licenses, ${Object.keys(o).length} populated operations datasets; stock movements and balanced journals verified.`);

const month=new Date().toISOString().slice(0,7);
const current=o.cashTransactions.filter(t=>t.transaction_date.startsWith(month));
assert.equal(current.filter(t=>t.kind==='receipt').reduce((s,t)=>s+t.amount,0),d.finance.filter(f=>f.direction==='receivable').reduce((s,f)=>s+f.paid,0));
assert.equal(current.filter(t=>t.kind==='salary').reduce((s,t)=>s+t.amount,0),o.payroll.filter(p=>p.status==='paid').reduce((s,p)=>s+p.net_amount,0));
assert.ok(current.some(t=>t.description.includes('PAY-001')&&t.amount===d.finance.find(f=>f.id==='f2').paid));
for(const a of d.assets){assert.ok(Number.isFinite(a.latitude)&&Number.isFinite(a.longitude));if(a.district_name==='مدينة الشروق')assert.ok(a.longitude>31.6);}
console.log('Current collections, paid payroll and authority payment reconcile; all 18 map coordinates validated.');
const methods=new Set(current.filter(t=>t.kind==='receipt').map(t=>t.payment_method));
assert.deepEqual([...methods].sort(),['bank_transfer','card','cash','instapay','vodafone_cash']);
for(const a of o.cashAccounts)assert.equal(a.balance,o.trialBalance.find(r=>r.id===a.ledger_account_id).balance);
console.log('All five collection channels present; receiving account balances match the ledger.');
