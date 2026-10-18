-- بيانات تجريبية: عميل تجريبي على دومين محلي
insert into tenants(id, name, slug) values ('00000000-0000-0000-0000-000000000001','عميل تجريبي','demo') on conflict(id) do nothing;
insert into tenant_domains(domain, tenant_id, is_primary, verified) values
  ('localhost','00000000-0000-0000-0000-000000000001', true, true),
  ('127.0.0.1','00000000-0000-0000-0000-000000000001', false, true)
  on conflict(domain) do nothing;
insert into tenant_modules(tenant_id, module_key) select '00000000-0000-0000-0000-000000000001', k
  from unnest(array['dashboard','customers','geography','assets','upstream_contracts','customer_contracts','finance','licenses','employees','attendance','payroll','inventory','purchases','maintenance','inspections','cashbook','reports','leads','audit']) k
  on conflict(tenant_id,module_key) do nothing;
-- بعد إنشاء أول مستخدم من Supabase Auth اربطه بالشركة:
-- insert into profiles(id, tenant_id, full_name, role) values ('<auth-user-uuid>','00000000-0000-0000-0000-000000000001','المدير العام','admin');
