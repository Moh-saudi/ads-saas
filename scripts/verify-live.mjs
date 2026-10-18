// Read-only hosted integration check. Credentials come from the invoking environment only.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const require = createRequire(new URL("../web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
try { process.loadEnvFile(new URL("../web/.env.local", import.meta.url)); } catch (e) { if (e.code !== "ENOENT") throw e; }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.LIVE_TEST_EMAIL;
const password = process.env.LIVE_TEST_PASSWORD;
if (!url || !key || !email || !password) {
  console.error("Set public Supabase configuration and LIVE_TEST_EMAIL / LIVE_TEST_PASSWORD in your environment.");
  process.exit(1);
}
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const user = createClient(url, key, options);
const anon = createClient(url, key, options);
const checks = [];
async function check(name, fn) { await fn(); checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
try {
  await check("Supabase Auth accepts configured account", async () => {
    const { data, error } = await user.auth.signInWithPassword({ email, password });
    assert.ifError(error); assert.ok(data.user?.id);
  });
  const identity = await user.auth.getUser(); assert.ifError(identity.error);
  const p = await user.from("profiles").select("tenant_id,role").eq("id", identity.data.user.id).single();
  assert.ifError(p.error); const tenant = p.data.tenant_id;
  await check("authenticated profile belongs to mapped host", async () => {
    const r = await anon.rpc("tenant_by_host", { h: "localhost" }); assert.ifError(r.error);
    assert.equal(r.data[0]?.id, tenant); assert.equal(p.data.role, "admin");
  });
  const tables = ["tenant_modules","parties","customer_contracts","upstream_contracts","streets","districts","governorates","asset_types","licenses","v_kpis","v_asset_register","v_invoice_balances",
    "employees","attendance","leave_requests","warehouses","inventory_items","v_stock_balances","stock_movements","purchase_orders","purchase_lines","work_orders","inspections","payroll_items","ledger_accounts","v_cash_balances","cash_transactions","journal_entries","journal_lines","v_trial_balance","v_monthly_cashflow","enquiries","audit_events","whatsapp_outbox","asset_tags","contract_installments","contract_lines"];
  // Small batches keep verification from flooding the hosted API.
  for (let i = 0; i < tables.length; i += 5) await Promise.all(tables.slice(i,i+5).map(table => check(`Data API / ${table}`, async () => {
    const r = await user.from(table).select("tenant_id").eq("tenant_id",tenant).limit(1); assert.ifError(r.error);
    assert.ok(r.data.every(row => row.tenant_id === tenant));
  })));
  for (const name of ["employee_directory","tenant_user_directory"]) await check(`RPC / ${name}`, async () => { const r = await user.rpc(name); assert.ifError(r.error); });
  await check("public catalog remains accessible", async () => { const r = await anon.rpc("public_catalog", { h:"localhost" }); assert.ifError(r.error); });
  await check("unknown domain does not resolve a company", async () => { const r = await anon.rpc("tenant_by_host",{h:"unverified.invalid"}); assert.ifError(r.error); assert.equal(r.data.length,0); });
  for (const table of ["assets","v_asset_register","employees","enquiries","journal_lines"]) await check(`anonymous private data denied / ${table}`, async () => {
    const r = await anon.from(table).select("*").limit(1); assert.ok(r.error, "Anonymous access must be denied explicitly");
  });
  const report = { verified_at:new Date().toISOString(), project:new URL(url).hostname, mode:"read-only API verification; no business records created", passed:checks.length, checks };
  const directory = resolve("output/verification"); await mkdir(directory,{recursive:true});
  await writeFile(resolve(directory,"live-integration.json"),JSON.stringify(report,null,2)+"\n");
  console.log(`${checks.length} hosted checks passed. No passwords, tokens or business rows written to report.`);
} catch (error) {
  // Do not dump client objects, headers or session state on failure.
  console.error(`Hosted verification failed: ${error.message}`); process.exitCode = 1;
} finally { await user.auth.signOut({scope:"local"}); }
