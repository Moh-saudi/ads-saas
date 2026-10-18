-- 0003: customer websites, brand settings and transactional contract creation.
begin;
alter table tenants add column logo_url text,
  add column primary_color text not null default '#0b1f4d' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column contact_phone text, add column contact_email text, add column whatsapp text,
  add column address text, add column website_title text, add column website_description text,
  add column public_site_enabled boolean not null default true;
alter table assets add column public_visible boolean not null default false;

-- Restrict the only anonymous lookup to verified domains and public brand attributes.
drop function tenant_by_host(text);
create function tenant_by_host(h text)
returns table(id uuid,name text,slug text,locale text,logo_url text,primary_color text,
  contact_phone text,contact_email text,whatsapp text,address text,website_title text,
  website_description text,public_site_enabled boolean)
language sql stable security definer set search_path = '' as $$
  select t.id,t.name,t.slug,t.locale,t.logo_url,t.primary_color,t.contact_phone,t.contact_email,t.whatsapp,
    t.address,t.website_title,t.website_description,t.public_site_enabled
  from public.tenants t join public.tenant_domains d on d.tenant_id=t.id
  where d.verified and d.domain=lower(rtrim(h,'.'))
$$;
revoke all on function tenant_by_host(text) from public;
grant execute on function tenant_by_host(text) to anon,authenticated;

create function public_catalog(h text)
returns table(code text,street text,category text,length_m numeric,width_m numeric,faces int)
language sql stable security definer set search_path = '' as $$
  select a.code,s.name,ty.name,a.length_m,a.width_m,a.faces from public.assets a
  join public.streets s on s.id=a.street_id join public.asset_types ty on ty.id=a.type_id
  join public.tenants t on t.id=a.tenant_id join public.tenant_domains d on d.tenant_id=t.id
  where d.verified and d.domain=lower(rtrim(h,'.')) and t.public_site_enabled and a.public_visible and a.status='active'
$$;
revoke all on function public_catalog(text) from public;
grant execute on function public_catalog(text) to anon,authenticated;

create function update_brand(p_name text,p_logo_url text,p_primary_color text,p_phone text,p_email text,
  p_whatsapp text,p_address text,p_title text,p_description text,p_public_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.auth_role() is distinct from 'admin' then raise exception 'FORBIDDEN'; end if;
  if length(trim(p_name))<2 or length(p_name)>160 or length(p_description)>2000 then raise exception 'INVALID_BRAND'; end if;
  if p_logo_url is not null and p_logo_url<>'' and p_logo_url !~ '^https://' then raise exception 'INVALID_LOGO_URL'; end if;
  update public.tenants set name=trim(p_name),logo_url=nullif(p_logo_url,''),primary_color=p_primary_color,
    contact_phone=p_phone,contact_email=p_email,whatsapp=p_whatsapp,address=p_address,
    website_title=p_title,website_description=p_description,public_site_enabled=p_public_enabled
    where id=public.auth_tenant();
end $$;
revoke all on function update_brand(text,text,text,text,text,text,text,text,text,boolean) from public;
grant execute on function update_brand(text,text,text,text,text,text,text,text,text,boolean) to authenticated;

create table chain_exceptions(
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  line_id uuid not null unique references contract_lines deferrable initially deferred,
  asset_id uuid not null, start_date date not null,end_date date not null,
  approved_by uuid not null references auth.users,reason text not null check(length(trim(reason))>=10),
  created_at timestamptz not null default now(), foreign key(tenant_id,asset_id) references assets(tenant_id,id));
alter table chain_exceptions enable row level security;
create policy read_exceptions on chain_exceptions for select to authenticated using
  (tenant_id=auth_tenant() and private.asset_access(asset_id));
revoke all on chain_exceptions from anon,authenticated;
grant select on chain_exceptions to authenticated;

create or replace function guard_chain() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.customer_contracts;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.tenant_id::text,0));
  select * into c from public.customer_contracts where id=new.contract_id and tenant_id=new.tenant_id;
  if c.id is null or new.start_date<c.start_date or new.end_date>c.end_date or (new.status='active' and c.status<>'active') then raise exception 'CONTRACT_PERIOD_CONFLICT'; end if;
  if new.status='active' and not exists(
    select 1 from public.upstream_contract_assets u join public.upstream_contracts uc on uc.id=u.upstream_contract_id
    where u.tenant_id=new.tenant_id and u.asset_id=new.asset_id and uc.status='active'
      and u.valid_from<=new.start_date and u.valid_to>=new.end_date
      and uc.start_date<=new.start_date and uc.end_date>=new.end_date)
    and not exists(select 1 from public.chain_exceptions e where e.line_id=new.id and e.tenant_id=new.tenant_id
      and e.asset_id=new.asset_id and e.start_date=new.start_date and e.end_date=new.end_date) then
    raise exception 'CHAIN_CONFLICT: فترة الإيجار تتجاوز تغطية العقد الصاعد';
  end if;
  return new;
end $$;
revoke all on function guard_chain() from public,anon,authenticated;

create function create_customer_contract(p_customer_id uuid,p_ref_no text,p_start date,p_end date,
  p_lines jsonb,p_override_reason text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t uuid:=public.auth_tenant(); c uuid:=gen_random_uuid(); l jsonb; lid uuid;
  total numeric:=0; price numeric;
begin
  if t is null or not private.allowed('sales') then raise exception 'FORBIDDEN'; end if;
  if p_start is null or p_end is null or p_end<p_start then raise exception 'INVALID_PERIOD'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>200 then raise exception 'INVALID_LINES'; end if;
  if p_override_reason is not null and (public.auth_role()<>'admin' or length(trim(p_override_reason))<10) then raise exception 'OVERRIDE_REQUIRES_ADMIN_AND_REASON'; end if;
  if not exists(select 1 from public.parties where id=p_customer_id and tenant_id=t and type='advertiser') then raise exception 'INVALID_CUSTOMER'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t::text,0));
  insert into public.customer_contracts(id,tenant_id,customer_id,ref_no,start_date,end_date,status)
    values(c,t,p_customer_id,p_ref_no,p_start,p_end,'active');
  for l in select value from jsonb_array_elements(p_lines) loop
    if not private.asset_access((l->>'asset_id')::uuid) or not exists(select 1 from public.assets
      where id=(l->>'asset_id')::uuid and tenant_id=t and status='active') then raise exception 'ASSET_OUT_OF_SCOPE'; end if;
    price:=(l->>'monthly_price')::numeric;
    if price is null or price<0 then raise exception 'INVALID_PRICE'; end if;
    lid:=gen_random_uuid();
    if p_override_reason is not null then
      insert into public.chain_exceptions(tenant_id,line_id,asset_id,start_date,end_date,approved_by,reason)
        values(t,lid,(l->>'asset_id')::uuid,p_start,p_end,auth.uid(),p_override_reason);
    end if;
    insert into public.contract_lines(id,tenant_id,contract_id,asset_id,start_date,end_date,monthly_price)
      values(lid,t,c,(l->>'asset_id')::uuid,p_start,p_end,price);
    total:=total+round(price*(p_end-p_start+1)/30.0,2);
  end loop;
  update public.customer_contracts set total_value=total where id=c;
  return c;
end $$;
revoke all on function create_customer_contract(uuid,text,date,date,jsonb,text) from public;
grant execute on function create_customer_contract(uuid,text,date,date,jsonb,text) to authenticated;

-- Keep active leases consistent when parent dates/status or coverage change after signing.
create function private.protect_parent_contract() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.tenant_id::text,0));
  if exists(select 1 from public.contract_lines l where l.contract_id=old.id and l.status='active'
    and (l.start_date<new.start_date or l.end_date>new.end_date or new.status in ('cancelled','draft'))) then
    raise exception 'CONTRACT_HAS_ACTIVE_LINES: ألغِ بنود العقد أولاً';
  end if;
  return new;
end $$;
create trigger protect_parent before update on customer_contracts for each row execute function private.protect_parent_contract();

create function private.protect_upstream() returns trigger
language plpgsql security definer set search_path = '' as $$
declare shrinks boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.tenant_id::text,0));
  if tg_op='DELETE' then shrinks:=true;
  elsif tg_table_name='upstream_contracts' then
    shrinks:=new.start_date>old.start_date or new.end_date<old.end_date or new.status<>'active';
  else shrinks:=new.valid_from>old.valid_from or new.valid_to<old.valid_to or new.asset_id<>old.asset_id or new.upstream_contract_id<>old.upstream_contract_id;
  end if;
  if shrinks and exists(select 1 from public.contract_lines l join public.upstream_contract_assets u on u.asset_id=l.asset_id
    where l.tenant_id=old.tenant_id and l.status='active' and
      ((tg_table_name='upstream_contracts' and u.upstream_contract_id=old.id) or (tg_table_name='upstream_contract_assets' and u.id=old.id))) then
    raise exception 'CHAIN_CONFLICT: توجد إيجارات نشطة تعتمد على هذه التغطية';
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger protect_upstream before update or delete on upstream_contracts for each row execute function private.protect_upstream();
create trigger protect_coverage before update or delete on upstream_contract_assets for each row execute function private.protect_upstream();

create or replace view v_assets_live with (security_invoker=true) as
select a.id,a.tenant_id,a.code,a.street_id,a.type_id,a.status,a.geom,
  cl.id as line_id,cl.end_date as lease_end,cl.monthly_price,u.monthly_cost,u.valid_to as coverage_end,
  case when a.status='maintenance' then 'maintenance' when cl.id is null then 'vacant'
    when cl.end_date-current_date<=60 then 'expiring' else 'leased' end as live_status,
  (cl.id is not null and not exists(select 1 from upstream_contract_assets cov
    join upstream_contracts uc on uc.id=cov.upstream_contract_id where cov.asset_id=a.id and uc.status='active'
      and cov.valid_from<=cl.start_date and cov.valid_to>=cl.end_date
      and uc.start_date<=cl.start_date and uc.end_date>=cl.end_date)) as chain_conflict
from assets a
left join contract_lines cl on cl.asset_id=a.id and cl.status='active' and current_date between cl.start_date and cl.end_date
left join upstream_contract_assets u on u.asset_id=a.id and current_date between u.valid_from and u.valid_to
  and exists(select 1 from upstream_contracts uc where uc.id=u.upstream_contract_id and uc.status='active' and current_date between uc.start_date and uc.end_date)
where a.status<>'retired';

create view v_asset_directory with (security_invoker=true) as
select v.*,s.name as street_name,s.district_id,d.name as district_name,ty.name as type_name,
  a.length_m,a.width_m,a.faces,a.material,a.public_visible,a.notes,
  st_y(a.geom) as latitude,st_x(a.geom) as longitude
from v_assets_live v join assets a on a.id=v.id join streets s on s.id=v.street_id
join districts d on d.id=s.district_id join asset_types ty on ty.id=v.type_id;
grant select on v_asset_directory to authenticated;
revoke all on v_assets_live,v_kpis,v_asset_directory from anon;
commit;
