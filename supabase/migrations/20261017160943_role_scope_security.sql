-- 0002: role permissions, district scope, immutable tenancy and composite references.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.profile() returns public.profiles
language sql stable security definer set search_path = '' as $$
  select p from public.profiles p where p.id = (select auth.uid())
$$;
revoke all on function private.profile() from public;
grant execute on function private.profile() to authenticated;

create function private.in_district(d uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = (select auth.uid())
    and (p.scope_district_id is null or p.scope_district_id = d))
$$;
create function private.asset_access(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.assets x join public.streets s on s.id=x.street_id
    join public.profiles p on p.tenant_id=x.tenant_id and p.id=(select auth.uid())
    where x.id=a and (p.scope_district_id is null or p.scope_district_id=s.district_id))
$$;
create function private.contract_access(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.customer_contracts x join public.profiles p
    on p.tenant_id=x.tenant_id and p.id=(select auth.uid()) where x.id=c and
    (p.scope_district_id is null or (exists(select 1 from public.contract_lines l where l.contract_id=x.id)
    and not exists(select 1 from public.contract_lines l join public.assets a on a.id=l.asset_id
      join public.streets s on s.id=a.street_id where l.contract_id=x.id and s.district_id<>p.scope_district_id))))
$$;
create function private.allowed(resource text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and
    (p.role='admin' or (resource='assets' and p.role in ('area_manager','supervisor'))
     or (resource='incidents' and p.role in ('area_manager','supervisor','inspector'))
     or (resource='sales' and p.role in ('area_manager','accounts'))
     or (resource='geography' and p.role='area_manager')
     or (resource='finance' and p.role in ('accounts','accountant'))))
$$;
revoke all on function private.in_district(uuid), private.asset_access(uuid), private.contract_access(uuid), private.allowed(text) from public;
grant execute on function private.in_district(uuid), private.asset_access(uuid), private.contract_access(uuid), private.allowed(text) to authenticated;

-- Keep existing public helpers compatible, but remove their implicit anonymous execution grants.
revoke all on function public.auth_tenant(), public.auth_role() from public;
grant execute on function public.auth_tenant(), public.auth_role() to authenticated;

create function private.immutable_tenant() returns trigger
language plpgsql set search_path = '' as $$ begin
  if new.tenant_id is distinct from old.tenant_id then raise exception 'TENANT_IMMUTABLE'; end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','parties','governorates','districts','streets','asset_types','assets',
    'asset_tags','asset_incidents','upstream_contracts','upstream_contract_assets','customer_contracts','contract_lines'] loop
    execute format('alter table public.%I add constraint %I unique (tenant_id,id)',t,t||'_tenant_id_key');
    execute format('create trigger immutable_tenant before update on public.%I for each row execute function private.immutable_tenant()',t);
    execute format('create index if not exists %I on public.%I(tenant_id)',t||'_tenant_idx',t);
  end loop;
  foreach t in array array['tenant_domains','tenant_modules'] loop
    execute format('create trigger immutable_tenant before update on public.%I for each row execute function private.immutable_tenant()',t);
  end loop;
end $$;
alter table profiles add foreign key (tenant_id,scope_district_id) references districts(tenant_id,id);
alter table districts add foreign key (tenant_id,governorate_id) references governorates(tenant_id,id);
alter table streets add foreign key (tenant_id,district_id) references districts(tenant_id,id);
alter table assets add foreign key (tenant_id,street_id) references streets(tenant_id,id),
  add foreign key (tenant_id,type_id) references asset_types(tenant_id,id),
  add constraint positive_dimensions check ((length_m is null or length_m>0) and (width_m is null or width_m>0) and faces>0);
alter table asset_tags add foreign key (tenant_id,asset_id) references assets(tenant_id,id);
alter table asset_incidents add foreign key (tenant_id,asset_id) references assets(tenant_id,id);
alter table upstream_contracts add foreign key (tenant_id,grantor_party_id) references parties(tenant_id,id),
  add foreign key (tenant_id,master_party_id) references parties(tenant_id,id),
  add check (end_date>=start_date), add check (annual_fee is null or annual_fee>=0);
alter table upstream_contract_assets add foreign key (tenant_id,asset_id) references assets(tenant_id,id),
  add foreign key (tenant_id,upstream_contract_id) references upstream_contracts(tenant_id,id),
  add check (valid_to>=valid_from), add check (monthly_cost>=0);
alter table customer_contracts add foreign key (tenant_id,customer_id) references parties(tenant_id,id),
  add check (end_date>=start_date), add check (total_value is null or total_value>=0);
alter table contract_lines add foreign key (tenant_id,contract_id) references customer_contracts(tenant_id,id),
  add foreign key (tenant_id,asset_id) references assets(tenant_id,id),
  add check (end_date>=start_date), add check (monthly_price>=0);

-- Replace ALL policies: an additional restrictive-looking policy would otherwise be OR-ed with 0001.
do $$ declare t text; scope_sql text; write_sql text; begin
  foreach t in array array['tenant_modules','parties','governorates','districts','streets','asset_types','assets',
    'asset_tags','asset_incidents','upstream_contracts','upstream_contract_assets','customer_contracts','contract_lines'] loop
    execute format('drop policy %I on public.%I',t||'_tenant',t);
    scope_sql := case t
      when 'districts' then 'private.in_district(id)'
      when 'streets' then 'private.in_district(district_id)'
      when 'assets' then 'exists(select 1 from public.streets s where s.id=street_id and private.in_district(s.district_id))'
      when 'asset_tags' then 'private.asset_access(asset_id)'
      when 'asset_incidents' then 'private.asset_access(asset_id)'
      when 'upstream_contract_assets' then 'private.asset_access(asset_id)'
      when 'contract_lines' then 'private.asset_access(asset_id)'
      when 'customer_contracts' then 'private.contract_access(id)'
      else 'true' end;
    write_sql := case
      when t='tenant_modules' then 'public.auth_role()=''admin'''
      when t in ('governorates','districts','streets') then 'private.allowed(''geography'')'
      when t in ('asset_types','assets','asset_tags') then 'private.allowed(''assets'')'
      when t='asset_incidents' then 'private.allowed(''incidents'')'
      when t in ('upstream_contracts','upstream_contract_assets') then 'public.auth_role()=''admin'''
      else 'private.allowed(''sales'')' end;
    execute format('create policy scoped_read on public.%I for select to authenticated using (tenant_id=public.auth_tenant() and (%s))',t,scope_sql);
    -- Scoped users create contracts through the atomic RPC in 0003; direct header writes require global scope.
    if t='customer_contracts' then scope_sql := '(private.profile()).scope_district_id is null'; end if;
    execute format('create policy scoped_insert on public.%I for insert to authenticated with check (tenant_id=public.auth_tenant() and (%s) and (%s))',t,scope_sql,write_sql);
    execute format('create policy scoped_update on public.%I for update to authenticated using (tenant_id=public.auth_tenant() and (%s) and (%s)) with check (tenant_id=public.auth_tenant() and (%s) and (%s))',t,scope_sql,write_sql,scope_sql,write_sql);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (tenant_id=public.auth_tenant() and public.auth_role()=''admin'')',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('revoke all on public.%I from anon',t);
  end loop;
end $$;

drop policy profiles_self on profiles;
create policy profiles_read on profiles for select to authenticated using (id=auth.uid() or (tenant_id=auth_tenant() and auth_role()='admin'));
-- User provisioning and role changes intentionally remain server-side SQL operations.
grant select on profiles,tenants to authenticated;
revoke insert,update,delete on profiles,tenants,tenant_domains from authenticated,anon;
grant select on v_assets_live,v_kpis to authenticated;
commit;
