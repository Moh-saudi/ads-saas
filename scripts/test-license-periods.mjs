import assert from 'node:assert/strict';
export async function testLicensePeriods({sql,ok,rejects,as,admin,manager,other,t1,a1,a2,a3,p1}) {
 const booking=(asset=a1,start='current_date',end='current_date+20',override='null')=>`select create_customer_contract('${p1}','LICENSE-CHECK',${start},${end},'[{"asset_id":"${asset}","monthly_price":100}]',${override}) id`;
 async function sandbox(fn){await sql('begin');try{await fn();}finally{await sql('rollback');}}
 await as(admin);
 await ok('license boundaries permit inclusive first and last day',()=>sandbox(async()=>{
  await sql(`update licenses set valid_from=current_date,expires_on=current_date+20 where asset_id='${a1}'`);
  assert.ok((await sql(booking())).rows[0].id);
 }));
 await ok('missing permit rejects booking and rolls back parent contract',()=>sandbox(async()=>{
  await sql(`update licenses set status='revoked' where asset_id='${a1}'`);
  await assert.rejects(()=>sql(booking()),/LICENSE_PERIOD_CONFLICT/);
 }));
 await ok('admin upstream exception cannot bypass expired permit',()=>sandbox(async()=>{
  await sql(`update licenses set expires_on=current_date-1 where asset_id='${a1}'`);
  await assert.rejects(()=>sql(booking(a1,'current_date','current_date+20',"'Documented upstream exception'")),/LICENSE_PERIOD_CONFLICT/);
 }));
 await ok('future permit cannot cover an earlier campaign',()=>sandbox(async()=>{
  await sql(`update licenses set valid_from=current_date+1 where asset_id='${a1}'`);
  await assert.rejects(()=>sql(booking()),/LICENSE_PERIOD_CONFLICT/);
 }));
 await ok('adjacent renewed permits jointly cover a campaign',()=>sandbox(async()=>{
  await sql(`update licenses set valid_from=current_date,expires_on=current_date+9 where asset_id='${a1}'`);
  await sql(`select register_asset_licenses(array['${a1}']::uuid[],'RENEW','Authority',current_date+10,current_date+20)`);
  assert.ok((await sql(booking())).rows[0].id);
 }));
 await ok('one day gap between permits blocks a campaign',()=>sandbox(async()=>{
  await sql(`update licenses set valid_from=current_date,expires_on=current_date+9 where asset_id='${a1}'`);
  await sql(`select register_asset_licenses(array['${a1}']::uuid[],'GAP','Authority',current_date+11,current_date+20)`);
  await assert.rejects(()=>sql(booking()),/LICENSE_PERIOD_CONFLICT/);
 }));
 for(const change of ['expires_on=current_date+5',"status='revoked'",'valid_from=current_date+1']) await ok('dependent booking protects permit '+change,()=>sandbox(async()=>{
  await sql(booking());
  await assert.rejects(()=>sql(`update licenses set ${change} where asset_id='${a1}'`),/LICENSE_HAS_ACTIVE_BOOKINGS/);
 }));
 await ok('service deletion cannot remove a permit backing active bookings',()=>sandbox(async()=>{
  await sql(booking());await sql('set local role service_role');
  await assert.rejects(()=>sql(`delete from licenses where asset_id='${a1}'`),/LICENSE_HAS_ACTIVE_BOOKINGS/);
 }));
 await ok('replacement covering permit permits withdrawal of old permit',()=>sandbox(async()=>{
  await sql(booking());
  await sql(`select register_asset_licenses(array['${a1}']::uuid[],'REPLACEMENT','Authority',current_date,current_date+100)`);
  await sql(`update licenses set status='revoked' where asset_id='${a1}' and ref_no<>'REPLACEMENT'`);
 }));
 await ok('one permit registers multiple distinct billboard locations atomically',()=>sandbox(async()=>{
  const r=await sql(`select register_asset_licenses(array['${a1}','${a2}','${a1}']::uuid[],'SHARED','City authority',current_date,current_date+10) n`);
  assert.equal(r.rows[0].n,2);
  assert.equal((await sql(`select * from licenses where ref_no='SHARED'`)).rows.length,2);
 }));
 await rejects('invalid permit dates denied',`select register_asset_licenses(array['${a1}']::uuid[],'BAD','Authority',current_date+1,current_date)`,/INVALID_LICENSE_PERIOD/);
 await rejects('cross tenant permit asset denied',`select register_asset_licenses(array['${a1}','${a3}']::uuid[],'CROSS','Authority',current_date,current_date+10)`,/ASSET_OUT_OF_SCOPE/);
 await ok('failed multi asset permit leaves no partial records',async()=>assert.equal((await sql("select * from licenses where ref_no='CROSS'")).rows.length,0));
 await as(manager);
 await rejects('district manager cannot issue permit outside scope',`select register_asset_licenses(array['${a2}']::uuid[],'SCOPE','Authority',current_date,current_date+10)`,/ASSET_OUT_OF_SCOPE/);
 await as(other);
 await ok('other tenant cannot read permit records',async()=>assert.equal((await sql(`select * from licenses where tenant_id='${t1}'`)).rows.length,0));
 await as(null,'anon');
 await rejects('anonymous permit registration denied',`select register_asset_licenses(array['${a1}']::uuid[],'ANON','Authority',current_date,current_date+10)`,/permission denied/);
 await as(admin);
}
