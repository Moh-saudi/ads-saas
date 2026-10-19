import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { postgis } from "@electric-sql/pglite-postgis";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { coordinateGeometry, parseCoordinates } from "../web/lib/coordinates.mjs";
import { testCollectionMethods } from "./test-collection-methods.mjs";
import { testAssetMedia } from "./test-asset-media.mjs";
import { testOperations } from "./test-operations.mjs";
import { testWebsite } from "./test-website.mjs";
const db = new PGlite({ extensions: { btree_gist, pgcrypto, postgis } });
let checks = 0;
const sql = (s, args = []) => db.query(s, args);
const id = (n) => `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
async function ok(name, fn) {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}
async function rejects(name, query, match) {
  await ok(name, async () => {
    await assert.rejects(
      () => sql(query),
      (e) => {
        assert.match(e.message, match);
        return true;
      },
    );
  });
}
async function as(user, role = "authenticated") {
  await db.exec(`reset role; set role ${role};`);
  await sql(`select set_config('request.jwt.claim.sub',$1,false)`, [
    user || "",
  ]);
}
try {
  // Match the tenant business date, including the hours when Cairo is ahead of UTC.
  await db.exec("set time zone 'Africa/Cairo'");
  // Only platform-owned Auth/Storage schemas are mocked; all application migrations run unchanged.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;
  create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
  create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
  grant usage on schema public,storage to anon,authenticated,service_role;
  grant select,insert,update,delete on storage.objects to authenticated;
  alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
  alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
  for (const file of (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  )
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
    console.log(`APPLIED ${file}`);
  }
  const t1 = id(1),
    t2 = id(2),
    g1 = id(11),
    g2 = id(12),
    d1 = id(21),
    d2 = id(22),
    d3 = id(23),
    s1 = id(31),
    s2 = id(32),
    s3 = id(33),
    ty1 = id(41),
    ty2 = id(42),
    a1 = id(51),
    a2 = id(52),
    a3 = id(53),
    p1 = id(61),
    p2 = id(62),
    admin = id(71),
    viewer = id(72),
    manager = id(73),
    accountant = id(74),
    other = id(75),
    inspector = id(76);
  await db.exec(`insert into tenants(id,name,slug) values('${t1}','A','a'),('${t2}','B','b');
  insert into tenant_domains(domain,tenant_id,verified) values('a.test','${t1}',true),('unverified.test','${t1}',false),('b.test','${t2}',true);
  insert into governorates(id,tenant_id,name) values('${g1}','${t1}','G1'),('${g2}','${t2}','G2');
  insert into districts(id,tenant_id,governorate_id,name) values('${d1}','${t1}','${g1}','D1'),('${d2}','${t1}','${g1}','D2'),('${d3}','${t2}','${g2}','D3');
  insert into streets(id,tenant_id,district_id,name) values('${s1}','${t1}','${d1}','S1'),('${s2}','${t1}','${d2}','S2'),('${s3}','${t2}','${d3}','S3');
  insert into asset_types(id,tenant_id,category,name) values('${ty1}','${t1}','pole','T1'),('${ty2}','${t2}','pole','T2');
  insert into assets(id,tenant_id,code,street_id,type_id,geom,public_visible) values('${a1}','${t1}','A1','${s1}','${ty1}',st_setsrid(st_point(31.4,30.1),4326),true),('${a2}','${t1}','A2','${s2}','${ty1}',null,false),('${a3}','${t2}','B1','${s3}','${ty2}',null,true);
  insert into parties(id,tenant_id,type,name) values('${p1}','${t1}','advertiser','P1'),('${p2}','${t2}','advertiser','P2');
  insert into auth.users(id) values('${admin}'),('${viewer}'),('${manager}'),('${accountant}'),('${other}'),('${inspector}');
  insert into profiles(id,tenant_id,role,scope_district_id) values('${admin}','${t1}','admin',null),('${viewer}','${t1}','viewer',null),('${manager}','${t1}','area_manager','${d1}'),('${accountant}','${t1}','accountant',null),('${other}','${t2}','admin',null),('${inspector}','${t1}','inspector','${d1}');`);
  await as(null, "anon");
  await ok("verified host returns only mapped tenant", async () =>
    assert.equal(
      (await sql(`select id from tenant_by_host('a.test')`)).rows[0].id,
      t1,
    ),
  );
  await ok("unverified domain denied", async () =>
    assert.equal(
      (await sql(`select * from tenant_by_host('unverified.test')`)).rows
        .length,
      0,
    ),
  );
  await ok("public catalog only explicitly published assets", async () =>
    assert.deepEqual(
      (await sql(`select code from public_catalog('a.test')`)).rows.map(
        (r) => r.code,
      ),
      ["A1"],
    ),
  );
  await rejects(
    "anonymous private asset access denied",
    "select * from assets",
    /permission denied/,
  );
  await as(viewer);
  await ok("RLS hides other tenant", async () =>
    assert.equal((await sql("select * from assets")).rows.length, 2),
  );
  await rejects(
    "viewer cannot write",
    `insert into parties(tenant_id,type,name) values('${t1}','advertiser','X')`,
    /row-level security/,
  );
  await rejects(
    "viewer cannot change role",
    `update profiles set role='admin' where id='${viewer}'`,
    /permission denied/,
  );
  await rejects(
    "viewer cannot change modules",
    `insert into tenant_modules(tenant_id,module_key) values('${t1}','finance')`,
    /row-level security/,
  );
  await as(manager);
  await ok("district scope filters assets and view", async () => {
    assert.equal((await sql("select * from assets")).rows.length, 1);
    assert.equal((await sql("select * from v_asset_directory")).rows.length, 1);
  });
  await rejects(
    "manager cannot move asset outside district",
    `update assets set street_id='${s2}' where id='${a1}'`,
    /row-level security/,
  );
  await rejects(
    "manager cannot create asset outside district",
    `insert into assets(tenant_id,code,street_id,type_id) values('${t1}','BAD','${s2}','${ty1}')`,
    /row-level security/,
  );
  await rejects(
    "manager cannot write global geography",
    `insert into governorates(tenant_id,name) values('${t1}','BAD')`,
    /row-level security/,
  );
  await as(admin);
  await rejects(
    "tenant id is immutable",
    `update parties set tenant_id='${t2}' where id='${p1}'`,
    /TENANT_IMMUTABLE/,
  );
  await rejects(
    "cross tenant foreign keys rejected",
    `insert into assets(tenant_id,code,street_id,type_id) values('${t1}','CROSS','${s1}','${ty2}')`,
    /foreign key/,
  );
  const upstream = (
    await sql(
      `select create_upstream_contract('UP',current_date-30,current_date+100,'lump_sum',12000,'[{"asset_id":"${a1}","monthly_cost":1000},{"asset_id":"${a2}","monthly_cost":1000}]') id`,
    )
  ).rows[0].id;
  const contractSql = (
    asset = a1,
    start = "current_date",
    end = "current_date+20",
    override = "null",
  ) =>
    `select create_customer_contract('${p1}','TEST',${start},${end},'[ {"asset_id":"${asset}","monthly_price":2000}]',${override}) id`;
  await ok("atomic contract creation", async () => {
    await sql(contractSql());
    assert.equal(
      (await sql("select * from customer_contracts")).rows.length,
      1,
    );
  });
  await rejects(
    "double booking blocked",
    contractSql(),
    /conflicting key|exclusion constraint/,
  );
  await ok("failed booking leaves no orphan contract", async () =>
    assert.equal(
      (await sql("select * from customer_contracts")).rows.length,
      1,
    ),
  );
  await rejects(
    "CHAIN_CONFLICT blocks outside coverage",
    contractSql(a2, "current_date", "current_date+120"),
    /CHAIN_CONFLICT/,
  );
  await sql(`set app.override_chain='on'`);
  await rejects(
    "old session flag cannot bypass guard",
    contractSql(a2, "current_date", "current_date+120"),
    /CHAIN_CONFLICT/,
  );
  await rejects(
    "upstream shortening rejected",
    `update upstream_contracts set end_date=current_date+5 where id='${upstream}'`,
    /CHAIN_CONFLICT/,
  );
  await rejects(
    "invalid empty line array rejected",
    `select create_customer_contract('${p1}','EMPTY',current_date,current_date+1,null)`,
    /INVALID_LINES/,
  );
  await ok("admin exception is audited", async () => {
    await sql(
      contractSql(
        a2,
        "current_date",
        "current_date+120",
        "'Approved documented exception'",
      ),
    );
    assert.equal((await sql("select * from chain_exceptions")).rows.length, 1);
  });
  await ok("PostGIS coordinates and RLS view", async () =>
    assert.equal(
      Number(
        (await sql(`select latitude from v_asset_directory where id='${a1}'`))
          .rows[0].latitude,
      ),
      30.1,
    ),
  );
  await ok("KPI totals and conflict flag", async () => {
    const k = (await sql("select * from v_kpis")).rows[0];
    assert.equal(Number(k.total_assets), 2);
    assert.equal(Number(k.chain_conflicts), 1);
    assert.equal(Number(k.monthly_revenue), 4000);
  });
  await as(manager);
  await rejects(
    "scope blocks contract on another district",
    contractSql(a2, "current_date+121", "current_date+125"),
    /ASSET_OUT_OF_SCOPE/,
  );
  await rejects(
    "nonadmin exception denied",
    contractSql(
      a1,
      "current_date+121",
      "current_date+125",
      "'Unauthorized exception reason'",
    ),
    /OVERRIDE_REQUIRES/,
  );
  await as(inspector);
  await ok("inspector can create incident in own district", async () =>
    sql(
      `insert into asset_incidents(tenant_id,asset_id,kind) values('${t1}','${a1}','inspection')`,
    ),
  );
  await rejects(
    "inspector cannot write asset core",
    `insert into assets(tenant_id,code,street_id,type_id) values('${t1}','BAD2','${s1}','${ty1}')`,
    /row-level security/,
  );
  await as(accountant);
  const inv = (
    await sql(
      `insert into invoices(tenant_id,ref_no,party_id,direction,amount,due_date) values('${t1}','INV','${p1}','receivable',5000,current_date) returning id`,
    )
  ).rows[0].id;
  await ok("partial payment recalculates invoice balance", async () => {
    await sql(`select record_payment('${inv}',2000,current_date,'bank')`);
    assert.equal(
      Number((await sql("select paid from v_invoice_balances")).rows[0].paid),
      2000,
    );
  });
  await rejects(
    "overpayment rejected",
    `select record_payment('${inv}',4000,current_date,'bank')`,
    /INVALID_PAYMENT/,
  );
  await rejects(
    "ledger cannot be edited directly",
    `insert into payments(tenant_id,invoice_id,amount,paid_on,created_by) values('${t1}','${inv}',1,current_date,'${accountant}')`,
    /permission denied/,
  );
  await as(other);
  await ok("second tenant cannot read first tenant invoices", async () =>
    assert.equal((await sql("select * from invoices")).rows.length, 0),
  );
  await rejects(
    "cross tenant payment rejected",
    `select record_payment('${inv}',1,current_date,'bank')`,
    /INVOICE_NOT_FOUND/,
  );
  await as(admin);
  await ok("brand changes scoped to tenant", async () => {
    await sql(
      `select update_brand('New A',null,'#168a45','123','mail@example.com',null,'address','title','description',true)`,
    );
    assert.equal((await sql(`select name from tenants`)).rows[0].name, "New A");
  });
  await rejects(
    "unsafe logo URL rejected",
    `select update_brand('Brand A','javascript:alert(1)','#168a45',null,null,null,null,null,null,true)`,
    /INVALID_LOGO_URL/,
  );
  await ok("admin may upload own logo", async () =>
    sql(
      `insert into storage.objects(bucket_id,name) values('tenant-logos','${t1}/logo.png')`,
    ),
  );
  await rejects(
    "admin cannot upload into another tenant folder",
    `insert into storage.objects(bucket_id,name) values('tenant-logos','${t2}/logo.png')`,
    /row-level security/,
  );
  const draft = id(99);
  await sql(
    `insert into customer_contracts(id,tenant_id,customer_id,start_date,end_date,status) values('${draft}','${t1}','${p1}',current_date,current_date+30,'draft')`,
  );
  await rejects(
    "reparenting a line rechecks parent status",
    `update contract_lines set contract_id='${draft}' where asset_id='${a1}'`,
    /CONTRACT_PERIOD_CONFLICT/,
  );
  await as(viewer);
  await rejects(
    "viewer cannot upload a logo",
    `insert into storage.objects(bucket_id,name) values('tenant-logos','${t1}/viewer.png')`,
    /row-level security/,
  );
  await rejects(
    "reminder enqueue is service-only",
    "select enqueue_renewal_reminders()",
    /permission denied/,
  );
  await rejects(
    "audit records cannot be forged",
    `insert into chain_exceptions(tenant_id,line_id,asset_id,start_date,end_date,approved_by,reason) values('${t1}',gen_random_uuid(),'${a1}',current_date,current_date+2,'${admin}','forged reason')`,
    /permission denied/,
  );
  await db.exec("reset role");
  await sql(
    `update parties set wa_opt_in=true,whatsapp='+201000000000' where id='${p1}'`,
  );
  await sql(
    `insert into tenant_modules(tenant_id,module_key,enabled) values('${t1}','whatsapp',true)`,
  );
  await sql(
    `update customer_contracts set end_date=current_date+60 where id=(select contract_id from contract_lines where asset_id='${a1}')`,
  );
  await as(null, "service_role");
  await ok("renewal reminder queued at 60 days", async () =>
    assert.equal(
      (await sql("select enqueue_renewal_reminders() n")).rows[0].n,
      1,
    ),
  );
  await ok("reminder insertion is idempotent", async () =>
    assert.equal(
      (await sql("select enqueue_renewal_reminders() n")).rows[0].n,
      0,
    ),
  );
  await ok("reminder claim is not repeated", async () => {
    assert.equal((await sql("select * from claim_reminders()")).rows.length, 1);
    assert.equal((await sql("select * from claim_reminders()")).rows.length, 0);
  });
  await testOperations({
    db,
    sql,
    as,
    ok,
    rejects,
    id,
    t1,
    t2,
    d1,
    d2,
    d3,
    a1,
    a2,
    admin,
    inspector,
    other,
    p1,
    upstream,
  });
  await testWebsite({db,sql,as,ok,rejects,t1,t2,admin,viewer,other});
  await as(admin);
  await ok("map selection rejects missing nonfinite and out-of-range coordinates", async () => {
    for (const [latitude, longitude] of [["", ""], ["30", ""], ["", "31"], ["NaN", "31"], ["30", "Infinity"], [91, 31], [30, 181], [-91, 31], [30, -181]]) {
      assert.equal(parseCoordinates(latitude, longitude), null);
      assert.equal(coordinateGeometry(latitude, longitude), null);
    }
    assert.deepEqual(parseCoordinates("0", "0"), { latitude: 0, longitude: 0 });
  });
  await ok("map-selected coordinates persist as a longitude-first PostGIS point", async () => {
    const geometry = coordinateGeometry("30.0123456", "31.1234567");
    const result = await sql(`insert into assets(tenant_id,code,street_id,type_id,geom)
      values($1,'MAP-PICKER-TEST',$2,$3,$4) returning st_y(geom) latitude,st_x(geom) longitude`, [t1, s1, ty1, geometry]);
    assert.equal(result.rows[0].latitude, 30.0123456);
    assert.equal(result.rows[0].longitude, 31.1234567);
  });
  await testAssetMedia({db,sql,as,ok,rejects,t1,t2,admin,viewer,manager,inspector,other,a1,a2});
  await testCollectionMethods({sql,as,ok,rejects,admin,viewer,other,t1,p1});
  console.log(
    `\n${checks} database assertions passed. Auth and Storage platform schemas are test fixtures.`,
  );
} catch (error) {
  console.error(
    "DATABASE TEST FAILED:",
    error.message,
    "code:",
    error.code,
    "position:",
    error.position,
    "detail:",
    error.detail || "",
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
