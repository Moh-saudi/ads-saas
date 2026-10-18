-- Example only. Replace all values; run manually as the trusted project owner.
-- Create the Auth user first. Never derive its role from user_metadata.
begin;
do $$
declare t uuid:=gen_random_uuid();
begin
  insert into public.tenants(id,name,slug,contact_phone,contact_email,website_title)
  values(t,'اسم الشركة','replace-client-slug','+201000000000','contact@example.com','مساحة يراها الجميع.');
  -- Uncomment after entering the actual Auth UUID:
  -- insert into public.profiles(id,tenant_id,full_name,role) values('AUTH_UUID',t,'المدير','admin');
  insert into public.tenant_modules(tenant_id,module_key)
  select t,k from unnest(array['dashboard','customers','geography','assets','upstream_contracts','customer_contracts','finance','licenses','employees','attendance','payroll','inventory','purchases','maintenance','inspections','cashbook','reports','leads','audit']) k;
  -- Add and verify only a domain you control, after configuring it on Vercel:
  -- insert into public.tenant_domains(domain,tenant_id,verified,is_primary) values('client.example.com',t,true,true);
end $$;
commit;
