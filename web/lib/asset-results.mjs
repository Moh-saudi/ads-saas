const day=v=>Date.parse(v.slice(0,10)+'T00:00:00Z')/86400000;
export const overlapDays=(a,b,c,d)=>Math.max(0,Math.min(day(b),day(d))-Math.max(day(a),day(c))+1);
export function assetPeriodResult(data,asset,start,end) {
 const o=data.operations, days=overlapDays(start,end,start,end);
 const lines=o.contractLines.filter(l=>l.asset_id===asset.id&&l.status==='active');
 const occupied=lines.reduce((n,l)=>n+overlapDays(l.start_date,l.end_date,start,end),0);
 const revenue=lines.reduce((n,l)=>n+Number(l.monthly_price)*overlapDays(l.start_date,l.end_date,start,end)/30,0);
 const workIds=new Set(o.workOrders.filter(w=>w.asset_id===asset.id).map(w=>w.id));
 const belongs=r=>r.asset_id===asset.id||workIds.has(r.work_order_id);
 const within=v=>{if(!v)return false;const date=v.length>10?new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v)):v;return date>=start&&date<=end;};
 const materials=o.stockMoves.filter(r=>belongs(r)&&within(r.created_at)).reduce((s,r)=>s+(['issue','adjustment_out'].includes(r.kind)?1:r.kind==='return'?-1:0)*Number(r.quantity)*Number(r.unit_cost),0);
 const expenses=o.cashTransactions.filter(r=>belongs(r)&&r.kind==='expense'&&within(r.transaction_date)).reduce((s,r)=>s+Number(r.amount),0);
 const concession=(o.upstreamCoverage||[]).filter(c=>c.asset_id===asset.id&&data.upstream.some(u=>u.id===c.upstream_contract_id&&u.status==='active')).reduce((s,c)=>{const u=data.upstream.find(u=>u.id===c.upstream_contract_id);return s+Number(c.monthly_cost)*overlapDays(c.valid_from>u.start_date?c.valid_from:u.start_date,c.valid_to<u.end_date?c.valid_to:u.end_date,start,end)/30;},0);
 const depDays=asset.install_date?overlapDays(asset.install_date,end,start,end):0;
 const depreciation=asset.cost!=null&&asset.useful_life_months>0?Math.max(0,Math.min(Number(asset.cost)-Math.min(Number(asset.cost),Math.max(0,day(start)-day(asset.install_date||start))*Number(asset.cost)/asset.useful_life_months/30),depDays*Number(asset.cost)/asset.useful_life_months/30)):0;
 return {revenue,materials,expenses,concession,depreciation,result:revenue-materials-expenses-concession-depreciation,occupancy:days?Math.min(100,occupied/days*100):0,days};
}
