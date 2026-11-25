export const paymentMethods = [
 {id:'cash',label:'نقدي',color:'#15865a'},
 {id:'bank_transfer',label:'تحويل بنكي',color:'#2363b0'},
 {id:'instapay',label:'إنستا باي',color:'#76519a'},
 {id:'vodafone_cash',label:'فودافون كاش',color:'#d71932'},
 {id:'card',label:'بطاقة بنكية (فيزا / ماستركارد)',color:'#dc8728'},
 {id:'other',label:'طريقة أخرى',color:'#567781'},
];
export function paymentMethodLabel(value){return paymentMethods.find(m=>m.id===value)?.label || 'غير محدد';}
export function collectionBreakdown(rows,start,end){
 const groups=[...paymentMethods,{id:'unknown',label:'غير محدد',color:'#8793a4'}].map(m=>({...m,amount:0,count:0}));
 for(const row of rows){
  if(!['receipt','income'].includes(row.kind)||row.transaction_date<start||row.transaction_date>end)continue;
  const amount=Number(row.amount);if(!Number.isFinite(amount)||amount<=0)continue;
  const group=groups.find(g=>g.id===row.payment_method)||groups.at(-1);
  group.amount=Math.round((group.amount+amount)*100)/100;group.count++;
 }
 const total=Math.round(groups.reduce((s,g)=>s+g.amount,0)*100)/100;
 return {total,groups:groups.map(g=>({...g,percent:total?g.amount/total*100:0}))};
}
