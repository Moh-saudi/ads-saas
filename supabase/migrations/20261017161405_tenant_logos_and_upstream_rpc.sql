-- 0005: tenant logo uploads and atomic upstream coverage creation.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tenant-logos','tenant-logos',true,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
create policy tenant_logo_insert on storage.objects for insert to authenticated
with check(bucket_id='tenant-logos' and (storage.foldername(name))[1]=public.auth_tenant()::text and public.auth_role()='admin');
-- UUID filenames avoid overwriting other objects. Logo URLs are intentionally public.
create policy tenant_logo_read on storage.objects for select to authenticated
using(bucket_id='tenant-logos' and (storage.foldername(name))[1]=public.auth_tenant()::text);

create function create_upstream_contract(p_ref text,p_start date,p_end date,p_model text,p_annual_fee numeric,p_assets jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant(); c uuid:=gen_random_uuid(); a jsonb;
begin
  if public.auth_role() is distinct from 'admin' then raise exception 'FORBIDDEN'; end if;
  if p_start is null or p_end is null or p_end<p_start then raise exception 'INVALID_PERIOD'; end if;
  if p_assets is null or jsonb_typeof(p_assets)<>'array' or jsonb_array_length(p_assets)<1 then raise exception 'INVALID_ASSETS'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t::text,0));
  insert into public.upstream_contracts(id,tenant_id,ref_no,scope,start_date,end_date,billing_model,annual_fee)
    values(c,t,p_ref,'scattered',p_start,p_end,p_model,p_annual_fee);
  for a in select value from jsonb_array_elements(p_assets) loop
    if not exists(select 1 from public.assets where id=(a->>'asset_id')::uuid and tenant_id=t) then raise exception 'ASSET_OUT_OF_SCOPE'; end if;
    insert into public.upstream_contract_assets(tenant_id,upstream_contract_id,asset_id,valid_from,valid_to,monthly_cost)
      values(t,c,(a->>'asset_id')::uuid,p_start,p_end,(a->>'monthly_cost')::numeric);
  end loop;
  return c;
end $$;
revoke all on function create_upstream_contract(text,date,date,text,numeric,jsonb) from public;
grant execute on function create_upstream_contract(text,date,date,text,numeric,jsonb) to authenticated;
commit;
