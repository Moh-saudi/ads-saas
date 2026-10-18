import assert from 'node:assert/strict';
import {checkAssetPhotoUpload} from './test-asset-photo-upload.mjs';
import {assetImageFormat,maxAssetImageBytes} from '../web/lib/asset-images.mjs';
import {locationCoverage} from '../web/lib/coordinates.mjs';
export async function testAssetMedia({db,sql,as,ok,rejects,t1,t2,admin,viewer,manager,inspector,other,a1,a2}) {
 await as(admin);
 await ok('photo preparation validates real file content and uploads only into a unique asset path',checkAssetPhotoUpload);
 await sql("insert into tenant_modules(tenant_id,module_key,enabled) values($1,'assets',true) on conflict(tenant_id,module_key) do update set enabled=true",[t1]);
 const photo=`${t1}/${a1}/photo.png`,outside=`${t1}/${a2}/outside.png`;
 await ok('asset photo bucket enforces private bounded image storage',async()=>{
  await db.exec('reset role');
  const b=(await sql("select * from storage.buckets where id='asset-photos'")).rows[0];
  assert.equal(b.public,false);assert.equal(Number(b.file_size_limit),maxAssetImageBytes);assert.deepEqual(b.allowed_mime_types,['image/png','image/jpeg','image/webp']);
  await as(admin);
 });
 await ok('admin attaches photos to assets without exposing them publicly',async()=>{
  await sql("insert into storage.objects(bucket_id,name) values('asset-photos',$1),('asset-photos',$2)",[photo,outside]);
  assert.equal((await sql("select * from storage.objects where bucket_id='asset-photos'")).rows.length,2);
 });
 await as(manager);
 await ok('asset photos follow district scope of the parent asset',async()=>{
  const rows=(await sql("select name from storage.objects where bucket_id='asset-photos'")).rows;
  assert.deepEqual(rows.map(r=>r.name),[photo]);
 });
 await rejects('scoped manager cannot upload photos outside district',`insert into storage.objects(bucket_id,name) values('asset-photos','${t1}/${a2}/bad.png')`,/row-level security/);
 await as(other);
 await ok('other company cannot read asset photographs',async()=>assert.equal((await sql("select * from storage.objects where bucket_id='asset-photos'")).rows.length,0));
 await rejects('other company cannot attach images to this asset',`insert into storage.objects(bucket_id,name) values('asset-photos','${photo}')`,/row-level security/);
 await as(viewer);
 await ok('viewer can view but cannot delete or replace asset photographs',async()=>{
  assert.equal((await sql("select * from storage.objects where name=$1",[photo])).rows.length,1);
  assert.equal((await sql("delete from storage.objects where name=$1 returning id",[photo])).rows.length,0);
  assert.equal((await sql("update storage.objects set name='moved' where name=$1 returning id",[photo])).rows.length,0);
 });
 await rejects('viewer cannot upload asset photos',`insert into storage.objects(bucket_id,name) values('asset-photos','${t1}/${a1}/viewer.png')`,/row-level security/);
 await rejects('viewer cannot correct an asset location',`select set_asset_location('${a1}',30.1,31.2,'Update point from map')`,/FORBIDDEN/);
 await as(manager);
 await rejects('location corrections cannot cross district scope',`select set_asset_location('${a2}',30.1,31.2,'Update point from map')`,/FORBIDDEN/);
 await as(admin);
 await rejects('invalid location is rejected by the database RPC',`select set_asset_location('${a1}',91,31.2,'Update point from map')`,/INVALID_COORDINATES/);
 await rejects('missing coordinates cannot overwrite a location',`select set_asset_location('${a1}',null,31.2,'Update point from map')`,/INVALID_COORDINATES/);
 await rejects('location correction requires an audit reason',`select set_asset_location('${a1}',30.1,31.2,'short')`,/REASON_REQUIRED/);
 await ok('location correction updates the register and preserves its reason',async()=>{
  await sql("select set_asset_location($1,30.1234567,31.7654321,'Survey confirmed the correct point')",[a1]);
  const row=(await sql('select latitude,longitude from v_asset_register where id=$1',[a1])).rows[0];
  assert.equal(row.latitude,30.1234567);assert.equal(row.longitude,31.7654321);
  const audit=(await sql("select changes from audit_events where record_id=$1 and operation='ASSET_LOCATION' order by created_at desc limit 1",[a1])).rows[0];
  assert.equal(audit.changes.reason,'Survey confirmed the correct point');assert.equal(audit.changes.after.latitude,30.1234567);
 });
 await ok('disabled asset module prevents photo access and location corrections',async()=>{
  await sql("update tenant_modules set enabled=false where tenant_id=$1 and module_key='assets'",[t1]);
  assert.equal((await sql("select * from storage.objects where bucket_id='asset-photos'")).rows.length,0);
  await assert.rejects(()=>sql("select set_asset_location($1,30,31,'Update point from map')",[a1]),/FORBIDDEN/);
  await sql("update tenant_modules set enabled=true where tenant_id=$1 and module_key='assets'",[t1]);
 });
 await ok('authorized deletion removes only the requested asset photo',async()=>{
  assert.equal((await sql("delete from storage.objects where name=$1 returning id",[photo])).rows.length,1);
  assert.equal((await sql("select * from storage.objects where bucket_id='asset-photos'")).rows.length,1);
 });
 await as(null,'anon');
 await rejects('anonymous visitors cannot read private asset photographs',"select * from storage.objects where bucket_id='asset-photos'",/permission denied/);
 await as(admin);
 await ok('geographic coverage distinguishes missing coordinates zero and retired assets',async()=>{
  assert.deepEqual(locationCoverage([{latitude:0,longitude:0,live_status:'vacant'},{latitude:null,longitude:null,live_status:'vacant'},{latitude:91,longitude:31,live_status:'leased'},{latitude:30,longitude:31,live_status:'retired'}]),{total:3,located:1,missing:2,percent:33});
  assert.deepEqual(locationCoverage([]),{total:0,located:0,missing:0,percent:0});
 });
 await ok('asset photo content validation rejects disguised documents empty and oversized files',async()=>{
  assert.equal(assetImageFormat(Uint8Array.from([137,80,78,71,13,10,26,10])).mime,'image/png');
  assert.equal(assetImageFormat(Uint8Array.from([255,216,255,224])).mime,'image/jpeg');
  assert.equal(assetImageFormat(new TextEncoder().encode('RIFF0000WEBP')).mime,'image/webp');
  assert.throws(()=>assetImageFormat(new TextEncoder().encode('<svg></svg>')),/IMAGE_FORMAT/);
  assert.throws(()=>assetImageFormat(new Uint8Array()),/IMAGE_SIZE/);
  assert.throws(()=>assetImageFormat(new Uint8Array(maxAssetImageBytes+1)),/IMAGE_SIZE/);
 });
}
