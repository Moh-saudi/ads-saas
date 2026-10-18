import assert from "node:assert/strict";
export async function testWebsite({db,sql,as,ok,rejects,t1,t2,admin,viewer,other}) {
 await as(admin);
 const content={about_title:"Original agency",about_text:"Verified company presentation",slides:[{title:"A campaign",accent:"A bigger presence",image_url:"/media/agency/city-night.webp"}],partners:[{name:"Local test partner",logo_url:"https://example.com/logo.png",website:"https://example.com"}]};
 await ok("company admin can save its own website content",async()=>{
  await sql("insert into tenant_website(tenant_id,content) values($1,$2)",[t1,JSON.stringify(content)]);
  assert.equal((await sql("select content->>'about_title' title from tenant_website")).rows[0].title,"Original agency");
 });
 await rejects("website content rejects executable image URLs", "update tenant_website set content=$1 where tenant_id=$2".replace("$1",`'${JSON.stringify({...content,slides:[{title:"Unsafe",image_url:"javascript:alert(1)"}]})}'`).replace("$2",`'${t1}'`),/INVALID_WEBSITE_URL/);
 await rejects("website content rejects non-string text payloads",`update tenant_website set content='{"about_title":[]}' where tenant_id='${t1}'`,/INVALID_WEBSITE_CONTENT/);
 await rejects("website content rejects excessive slide collections",`update tenant_website set content='${JSON.stringify({slides:Array.from({length:9},()=>({title:"Slide",image_url:"/media/agency/city-night.webp"}))})}' where tenant_id='${t1}'`,/INVALID_WEBSITE_CONTENT/);
 await rejects("website slides require a safe image",`update tenant_website set content='{"slides":[{"title":"Missing image"}]}' where tenant_id='${t1}'`,/INVALID_WEBSITE_CONTENT/);
 await rejects("website tenant cannot be reassigned",`update tenant_website set tenant_id='${t2}' where tenant_id='${t1}'`,/TENANT_IMMUTABLE|row-level security/);
 await as(viewer);
 await ok("non-admin cannot view editor configuration directly",async()=>assert.equal((await sql("select * from tenant_website")).rows.length,0));
 await ok("non-admin cannot change website configuration",async()=>assert.equal((await sql(`update tenant_website set content='{}' where tenant_id='${t1}' returning tenant_id`)).rows.length,0));
 await as(other);
 await ok("website editor remains isolated across companies",async()=>assert.equal((await sql(`select * from tenant_website where tenant_id='${t1}'`)).rows.length,0));
 await as(null,"anon");
 await rejects("anonymous visitors cannot read website editor table", "select * from tenant_website",/permission denied/);
 await ok("public website RPC returns only mapped public presentation",async()=>{
  const row=(await sql("select public_website('a.test') site")).rows[0].site;
  assert.equal(row.content.about_title,"Original agency");assert.equal(row.content.partners.length,1);assert.ok(row.areas.includes("D1"));
  assert.deepEqual(Object.keys(row).sort(),["areas","content"]);
 });
 await ok("public website does not resolve unknown or unverified domains",async()=>{
  assert.equal((await sql("select public_website('unverified.test') site")).rows[0].site,null);
  assert.equal((await sql("select public_website('unknown.test') site")).rows[0].site,null);
 });
 await db.exec("reset role");await sql(`update tenants set public_site_enabled=false where id='${t1}'`);await as(null,"anon");
 await ok("disabled public site does not expose website content",async()=>assert.equal((await sql("select public_website('a.test') site")).rows[0].site,null));
 await db.exec("reset role");await sql(`update tenants set public_site_enabled=true where id='${t1}'`);await as(admin);
 await ok("website media upload is tenant-admin scoped",async()=>{
  await sql(`insert into storage.objects(bucket_id,name) values('tenant-website','${t1}/hero.webp')`);
 });
 await rejects("website media cannot be uploaded into another company",`insert into storage.objects(bucket_id,name) values('tenant-website','${t2}/hero.webp')`,/row-level security/);
 await as(viewer);
 await rejects("non-admin cannot upload website media",`insert into storage.objects(bucket_id,name) values('tenant-website','${t1}/viewer.webp')`,/row-level security/);
 await as(admin);
}
