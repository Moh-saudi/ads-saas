-- Fresh database only. All migrations in one atomic transaction. Does not include demo seed.
begin;
-- SOURCE: 0001_core_assets_contracts.sql
-- Mesk Signage Platform — Migration 0001 (المرحلة 1): النواة + الجغرافيا + الأصول + العقود + حماية التعارض
create extension if not exists postgis;
create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ===== النواة وتعدد الشركات =====
create table tenants(
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text unique not null,
  currency text not null default 'EGP', timezone text not null default 'Africa/Cairo', locale text not null default 'ar',
  created_at timestamptz not null default now());

create table tenant_domains(            -- دومين خاص لكل عميل (الموقع على دومينه)
  domain text primary key,
  tenant_id uuid not null references tenants on delete cascade,
  is_primary boolean not null default false,
  verified boolean not null default false,
  created_at timestamptz not null default now());

create table tenant_modules(
  tenant_id uuid not null references tenants on delete cascade,
  module_key text not null, enabled boolean not null default true, config jsonb not null default '{}',
  primary key (tenant_id, module_key));

create table profiles(
  id uuid primary key references auth.users on delete cascade,
  tenant_id uuid not null references tenants,
  full_name text, phone text,
  role text not null default 'viewer' check (role in ('admin','area_manager','accounts','accountant','supervisor','inspector','storekeeper','hr','viewer')),
  scope_district_id uuid,
  created_at timestamptz not null default now());

create or replace function auth_tenant() returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from profiles where id = auth.uid() $$;

create or replace function auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() $$;

-- يعيد بيانات عامة بسيطة فقط عن العميل حسب الدومين (يستخدمها الـ middleware قبل تسجيل الدخول)
create or replace function tenant_by_host(h text)
returns table(id uuid, name text, slug text, locale text)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.slug, t.locale from tenants t
  join tenant_domains d on d.tenant_id = t.id where d.domain = lower(h) $$;
revoke all on function tenant_by_host(text) from public;
grant execute on function tenant_by_host(text) to anon, authenticated;

-- ===== الأطراف =====
create table parties(
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  type text not null check (type in ('advertiser','agency','authority','master_concessionaire','supplier')),
  name text not null, tax_no text, phone text, whatsapp text, wa_opt_in boolean not null default false,
  status text not null default 'active', notes text,
  created_at timestamptz not null default now());

-- ===== الجغرافيا =====
create table governorates(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants, name text not null);
create table districts(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  governorate_id uuid not null references governorates, name text not null, geom geometry(MultiPolygon,4326));
create table streets(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  district_id uuid not null references districts, name text not null, geom geometry(LineString,4326),
  holding text not null default 'partial' check (holding in ('full','partial')));  -- full = الشارع كاملاً لنا

-- ===== الأصول =====
create table asset_types(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  category text not null check (category in ('pole','sidewalk_sign','billboard','other')), name text not null,
  default_length_m numeric(6,2), default_width_m numeric(6,2), faces int not null default 1,
  material text, useful_life_months int, base_monthly_price numeric(14,2));

create table assets(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  code text not null, street_id uuid not null references streets, type_id uuid not null references asset_types,
  length_m numeric(6,2), width_m numeric(6,2), faces int not null default 1, material text,
  install_date date, cost numeric(14,2), useful_life_months int,
  status text not null default 'active' check (status in ('active','maintenance','retired')),
  geom geometry(Point,4326), traffic_score int default 50, notes text,
  created_at timestamptz not null default now(), unique (tenant_id, code));
create index on assets using gist (geom);

create table asset_tags(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  asset_id uuid not null references assets on delete cascade, kind text not null check (kind in ('rfid','nfc','qr')),
  uid text not null unique, active boolean not null default true);

create table asset_incidents(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  asset_id uuid not null references assets on delete cascade, occurred_at timestamptz not null default now(),
  kind text not null, severity int, description text, repair_cost numeric(14,2), resolved_at timestamptz);

-- ===== العقود الصاعدة (من الوطنية) =====
create table upstream_contracts(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  grantor_party_id uuid references parties, master_party_id uuid references parties, ref_no text,
  scope text not null check (scope in ('full_streets','scattered','poles')),
  start_date date not null, end_date date not null, annual_fee numeric(14,2),
  billing_model text not null default 'lump_sum' check (billing_model in ('lump_sum','per_asset','per_m2')),
  status text not null default 'active');

create table upstream_contract_assets(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  upstream_contract_id uuid not null references upstream_contracts on delete cascade,
  asset_id uuid not null references assets on delete cascade,
  valid_from date not null, valid_to date not null, monthly_cost numeric(14,2) not null default 0,
  period daterange generated always as (daterange(valid_from, valid_to, '[]')) stored,
  exclude using gist (asset_id with =, period with &&));

-- ===== العقود النازلة (للمعلنين) =====
create table customer_contracts(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  customer_id uuid not null references parties, ref_no text, start_date date not null, end_date date not null,
  status text not null default 'draft' check (status in ('draft','active','expired','cancelled')),
  total_value numeric(14,2), signed_at timestamptz);

create table contract_lines(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  contract_id uuid not null references customer_contracts on delete cascade,
  asset_id uuid not null references assets, start_date date not null, end_date date not null,
  monthly_price numeric(14,2) not null, status text not null default 'active' check (status in ('active','cancelled')),
  period daterange generated always as (daterange(start_date, end_date, '[]')) stored,
  exclude using gist (asset_id with =, period with &&) where (status = 'active'));   -- يمنع الحجز المزدوج

-- حارس سلسلة التعاقد: لا إيجار يتجاوز تغطية عقدنا الصاعد (الاستثناء بصلاحية: set local app.override_chain='on')
create or replace function guard_chain() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.override_chain', true), 'off') = 'on' then return new; end if;
  if new.status = 'active' and not exists (
      select 1 from upstream_contract_assets u
      where u.asset_id = new.asset_id and u.valid_from <= new.start_date and u.valid_to >= new.end_date) then
    raise exception 'CHAIN_CONFLICT: فترة الإيجار تتجاوز تغطية العقد الصاعد للعنصر %', new.asset_id using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_guard_chain before insert or update of asset_id, start_date, end_date, status
  on contract_lines for each row execute function guard_chain();

-- ===== عروض اللوحة اللحظية (تحترم RLS) =====
create view v_assets_live with (security_invoker = true) as
select a.id, a.tenant_id, a.code, a.street_id, a.type_id, a.status, a.geom,
  cl.id as line_id, cl.end_date as lease_end, cl.monthly_price,
  u.monthly_cost, u.valid_to as coverage_end,
  case when a.status = 'maintenance' then 'maintenance'
       when cl.id is null then 'vacant'
       when cl.end_date - current_date <= 60 then 'expiring' else 'leased' end as live_status,
  coalesce(cl.end_date > u.valid_to, false) as chain_conflict
from assets a
left join contract_lines cl on cl.asset_id = a.id and cl.status = 'active' and current_date between cl.start_date and cl.end_date
left join upstream_contract_assets u on u.asset_id = a.id and current_date between u.valid_from and u.valid_to
where a.status <> 'retired';

create view v_kpis with (security_invoker = true) as
select tenant_id, count(*) as total_assets,
  count(*) filter (where live_status in ('leased','expiring')) as leased,
  round(100.0 * count(*) filter (where live_status in ('leased','expiring')) / nullif(count(*),0), 1) as occupancy_pct,
  coalesce(sum(monthly_price),0) as monthly_revenue, coalesce(sum(monthly_cost),0) as monthly_cost,
  coalesce(sum(monthly_price),0) - coalesce(sum(monthly_cost),0) as net_margin,
  count(*) filter (where live_status = 'expiring') as expiring_soon,
  count(*) filter (where chain_conflict) as chain_conflicts
from v_assets_live group by tenant_id;

-- ===== RLS: عزل كل شركة =====
alter table tenants enable row level security;
create policy tenants_own on tenants for select to authenticated using (id = auth_tenant());
alter table profiles enable row level security;
create policy profiles_self on profiles for select to authenticated using (id = auth.uid() or tenant_id = auth_tenant());
alter table tenant_domains enable row level security;   -- بدون سياسات: لا وصول مباشر، فقط عبر tenant_by_host

do $$ declare t text; begin
  foreach t in array array['tenant_modules','parties','governorates','districts','streets','asset_types','assets','asset_tags',
    'asset_incidents','upstream_contracts','upstream_contract_assets','customer_contracts','contract_lines'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (tenant_id = auth_tenant()) with check (tenant_id = auth_tenant())', t || '_tenant', t);
  end loop;
end $$;
-- ملاحظة: صلاحيات الكتابة حسب الدور (auth_role()) تُضاف في Migration 0002.


-- SOURCE: 20261017160943_role_scope_security.sql
-- 0002: role permissions, district scope, immutable tenancy and composite references.

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


-- SOURCE: 20261017161052_branding_contract_workflows.sql
-- 0003: customer websites, brand settings and transactional contract creation.

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


-- SOURCE: 20261017161204_finance_licenses_reminders.sql
-- 0004: invoices, receipts, national-company dues, licenses, and opt-in reminder outbox.

alter table customer_contracts add column created_at timestamptz not null default now();
create table invoices(
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,
  ref_no text not null,party_id uuid not null,contract_id uuid,
  direction text not null check(direction in ('receivable','payable')),
  amount numeric(14,2) not null check(amount>0),due_date date not null,
  created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,ref_no),
  foreign key(tenant_id,party_id) references parties(tenant_id,id),
  foreign key(tenant_id,contract_id) references customer_contracts(tenant_id,id));
create table payments(
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,
  invoice_id uuid not null,amount numeric(14,2) not null check(amount>0),paid_on date not null,
  reference text,created_by uuid not null references auth.users,created_at timestamptz not null default now(),
  foreign key(tenant_id,invoice_id) references invoices(tenant_id,id));
create table licenses(
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,
  asset_id uuid not null,ref_no text not null,issuer text not null,expires_on date not null,
  foreign key(tenant_id,asset_id) references assets(tenant_id,id),unique(tenant_id,ref_no));
create table whatsapp_outbox(
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,
  contract_id uuid not null,party_id uuid not null,days_before int not null check(days_before in (60,30,7)),
  renewal_date date not null,status text not null default 'pending' check(status in ('pending','processing','sent','failed','uncertain')),
  provider_message_id text,last_error text,created_at timestamptz not null default now(),sent_at timestamptz,
  foreign key(tenant_id,contract_id) references customer_contracts(tenant_id,id),
  foreign key(tenant_id,party_id) references parties(tenant_id,id),
  unique(tenant_id,contract_id,renewal_date,days_before));
do $$ declare t text; begin
  foreach t in array array['invoices','payments','licenses','whatsapp_outbox'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create index on public.%I(tenant_id)',t);
    execute format('create trigger immutable_tenant before update on public.%I for each row execute function private.immutable_tenant()',t);
  end loop;
end $$;
create policy invoice_read on invoices for select to authenticated using(tenant_id=auth_tenant() and private.allowed('finance'));
create policy invoice_insert on invoices for insert to authenticated with check(tenant_id=auth_tenant() and private.allowed('finance')
  and (contract_id is null or private.contract_access(contract_id)));
create policy payment_read on payments for select to authenticated using(tenant_id=auth_tenant() and private.allowed('finance'));
create policy license_read on licenses for select to authenticated using(tenant_id=auth_tenant() and private.asset_access(asset_id));
create policy license_insert on licenses for insert to authenticated with check(tenant_id=auth_tenant() and private.asset_access(asset_id) and private.allowed('assets'));
create policy license_update on licenses for update to authenticated using(tenant_id=auth_tenant() and private.asset_access(asset_id) and private.allowed('assets'))
  with check(tenant_id=auth_tenant() and private.asset_access(asset_id) and private.allowed('assets'));
create policy outbox_read on whatsapp_outbox for select to authenticated using(tenant_id=auth_tenant() and auth_role()='admin');
revoke all on invoices,payments,licenses,whatsapp_outbox from anon,authenticated;
grant select,insert on invoices to authenticated;
grant select on payments,whatsapp_outbox to authenticated;
grant select,insert,update on licenses to authenticated;
grant all on invoices,payments,licenses,whatsapp_outbox to service_role;

create view v_invoice_balances with(security_invoker=true) as
select i.*,coalesce(p.paid,0) as paid,
  case when coalesce(p.paid,0)>=i.amount then 'paid' else 'open' end as status
from invoices i left join (select invoice_id,sum(amount) as paid from payments group by invoice_id) p on p.invoice_id=i.id;
grant select on v_invoice_balances to authenticated;
revoke all on v_invoice_balances from anon;

create function record_payment(p_invoice_id uuid,p_amount numeric,p_paid_on date,p_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare inv public.invoices; paid numeric; result uuid;
begin
  if not private.allowed('finance') then raise exception 'FORBIDDEN'; end if;
  select * into inv from public.invoices where id=p_invoice_id and tenant_id=public.auth_tenant() for update;
  if inv.id is null then raise exception 'INVOICE_NOT_FOUND'; end if;
  if not (private.contract_access(inv.contract_id) or (inv.contract_id is null and (private.profile()).scope_district_id is null)) then raise exception 'FORBIDDEN'; end if;
  select coalesce(sum(amount),0) into paid from public.payments where invoice_id=inv.id;
  if p_amount is null or p_amount<=0 or p_amount>inv.amount-paid then raise exception 'INVALID_PAYMENT: قيمة الدفعة تتجاوز المتبقي'; end if;
  insert into public.payments(tenant_id,invoice_id,amount,paid_on,reference,created_by)
    values(inv.tenant_id,inv.id,p_amount,p_paid_on,p_reference,auth.uid()) returning id into result;
  return result;
end $$;
revoke all on function record_payment(uuid,numeric,date,text) from public;
grant execute on function record_payment(uuid,numeric,date,text) to authenticated;

create function enqueue_renewal_reminders() returns int
language plpgsql security definer set search_path='' as $$
declare n int;
begin
  insert into public.whatsapp_outbox(tenant_id,contract_id,party_id,days_before,renewal_date)
  select c.tenant_id,c.id,c.customer_id,d,c.end_date from public.customer_contracts c
  join public.parties p on p.id=c.customer_id and p.wa_opt_in and p.whatsapp is not null
  join public.tenants t on t.id=c.tenant_id
  join public.tenant_modules m on m.tenant_id=c.tenant_id and m.module_key='whatsapp' and m.enabled
  cross join unnest(array[60,30,7]) d
  where c.status='active' and c.end_date-(now() at time zone t.timezone)::date=d
  on conflict do nothing;
  get diagnostics n=row_count; return n;
end $$;
create function claim_reminders() returns setof public.whatsapp_outbox
language sql security definer set search_path='' as $$
  update public.whatsapp_outbox set status='processing'
  where id in(select id from public.whatsapp_outbox where status='pending' order by created_at limit 50 for update skip locked)
  returning *
$$;
revoke all on function enqueue_renewal_reminders(),claim_reminders() from public,anon,authenticated;
grant execute on function enqueue_renewal_reminders(),claim_reminders() to service_role;


-- SOURCE: 20261017161405_tenant_logos_and_upstream_rpc.sql
-- 0005: tenant logo uploads and atomic upstream coverage creation.

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


-- SOURCE: 20261017162654_harden_contract_integrity.sql
-- 0006: immutable privileged lookups and header/coverage consistency.

revoke create on schema public from public,anon,authenticated;
create or replace function auth_tenant() returns uuid language sql stable security definer set search_path='' as $$
select tenant_id from public.profiles where id=(select auth.uid()) $$;
create or replace function auth_role() returns text language sql stable security definer set search_path='' as $$
select role from public.profiles where id=(select auth.uid()) $$;
drop trigger trg_guard_chain on contract_lines;
create trigger trg_guard_chain before insert or update on contract_lines for each row execute function guard_chain();

create function private.validate_coverage() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.upstream_contracts c where c.id=new.upstream_contract_id and c.tenant_id=new.tenant_id
    and c.start_date<=new.valid_from and c.end_date>=new.valid_to) then raise exception 'COVERAGE_OUTSIDE_UPSTREAM'; end if;
  return new;
end $$;
create trigger coverage_within_parent before insert or update on upstream_contract_assets for each row execute function private.validate_coverage();

alter table upstream_contracts add constraint upstream_status_valid check(status in ('active','draft','expired','cancelled'));
alter table upstream_contracts add check(annual_fee<>'NaN'::numeric);
alter table upstream_contract_assets add check(monthly_cost<>'NaN'::numeric);
alter table contract_lines add check(monthly_price<>'NaN'::numeric);
alter table customer_contracts add check(total_value<>'NaN'::numeric);
alter table invoices add check(amount<>'NaN'::numeric);
alter table payments add check(amount<>'NaN'::numeric);
-- Organization-level geography can only be edited by an unrestricted administrator.
drop policy scoped_insert on governorates;
drop policy scoped_update on governorates;
create policy admin_insert on governorates for insert to authenticated with check(tenant_id=auth_tenant() and auth_role()='admin');
create policy admin_update on governorates for update to authenticated using(tenant_id=auth_tenant() and auth_role()='admin') with check(tenant_id=auth_tenant() and auth_role()='admin');

-- Finance rows attached to a contract inherit that contract's complete district scope.
drop policy invoice_read on invoices;
drop policy payment_read on payments;
drop policy invoice_insert on invoices;
create policy invoice_read on invoices for select to authenticated using(tenant_id=auth_tenant() and private.allowed('finance') and
  (private.contract_access(contract_id) or (contract_id is null and (private.profile()).scope_district_id is null)));
create policy payment_read on payments for select to authenticated using(tenant_id=auth_tenant() and private.allowed('finance')
  and exists(select 1 from public.invoices i where i.id=invoice_id));
create policy invoice_insert on invoices for insert to authenticated with check(tenant_id=auth_tenant() and private.allowed('finance') and
  (private.contract_access(contract_id) or (contract_id is null and (private.profile()).scope_district_id is null)));


-- SOURCE: 20261017165518_operations_hr_inventory_finance.sql
-- 0007: complete operational records. All business mutations use controlled RPCs.

create table employees(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,
 profile_id uuid,code text not null,full_name text not null check(length(trim(full_name))>1),
 department text not null default '',job_title text not null default '',phone text,email text,
 district_id uuid,hire_date date not null,base_salary numeric(14,2) not null default 0 check(base_salary>=0 and base_salary<>'NaN'),
 status text not null default 'active' check(status in ('active','suspended','terminated')),
 created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,code),unique(tenant_id,profile_id),
 foreign key(tenant_id,profile_id) references profiles(tenant_id,id),foreign key(tenant_id,district_id) references districts(tenant_id,id));
create table attendance(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,employee_id uuid not null,
 work_date date not null,check_in timestamptz not null,check_out timestamptz,
 notes text,recorded_by uuid not null references auth.users,created_at timestamptz not null default now(),
 check(check_out is null or check_out>=check_in),unique(tenant_id,employee_id,work_date),
 foreign key(tenant_id,employee_id) references employees(tenant_id,id));
create table leave_requests(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,employee_id uuid not null,
 start_date date not null,end_date date not null check(end_date>=start_date),kind text not null check(kind in ('annual','sick','unpaid','other')),
 reason text not null,status text not null default 'pending' check(status in ('pending','approved','rejected')),
 decided_by uuid references auth.users,decision_note text,created_at timestamptz not null default now(),
 foreign key(tenant_id,employee_id) references employees(tenant_id,id));
create table warehouses(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,code text not null,name text not null,
 district_id uuid not null,address text,active boolean not null default true,unique(tenant_id,id),unique(tenant_id,code),
 foreign key(tenant_id,district_id) references districts(tenant_id,id));
create table inventory_items(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,sku text not null,name text not null,
 unit text not null default 'قطعة',reorder_level numeric(14,3) not null default 0 check(reorder_level>=0 and reorder_level<>'NaN'),
 active boolean not null default true,unique(tenant_id,id),unique(tenant_id,sku));
create table work_orders(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,ref_no text not null,
 asset_id uuid not null,title text not null,description text,assigned_employee_id uuid,
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 status text not null default 'open' check(status in ('open','assigned','in_progress','completed','cancelled')),
 due_date date not null,completed_at timestamptz,resolution text,
 created_by uuid not null references auth.users,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,ref_no),
 foreign key(tenant_id,asset_id) references assets(tenant_id,id),foreign key(tenant_id,assigned_employee_id) references employees(tenant_id,id));
create table inspections(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,asset_id uuid not null,
 inspector_id uuid not null references auth.users,checked_at timestamptz not null default now(),
 condition text not null check(condition in ('good','needs_maintenance','damaged','missing')),
 method text not null check(method in ('manual','qr','nfc')),tag_uid text,notes text not null,
 latitude double precision check(latitude between -90 and 90),longitude double precision check(longitude between -180 and 180),
 foreign key(tenant_id,asset_id) references assets(tenant_id,id));
create table purchase_orders(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,ref_no text not null,
 supplier_id uuid not null,warehouse_id uuid not null,ordered_on date not null,expected_on date,
 status text not null default 'ordered' check(status in ('ordered','received','cancelled')),
 notes text,created_by uuid not null references auth.users,received_at timestamptz,
 unique(tenant_id,id),unique(tenant_id,ref_no),
 foreign key(tenant_id,supplier_id) references parties(tenant_id,id),foreign key(tenant_id,warehouse_id) references warehouses(tenant_id,id));
create table purchase_lines(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,purchase_id uuid not null,item_id uuid not null,
 quantity numeric(14,3) not null check(quantity>0 and quantity<>'NaN'),unit_cost numeric(14,4) not null check(unit_cost>=0 and unit_cost<>'NaN'),
 unique(purchase_id,item_id),foreign key(tenant_id,purchase_id) references purchase_orders(tenant_id,id),
 foreign key(tenant_id,item_id) references inventory_items(tenant_id,id));
create table stock_movements(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,ref_no text not null,
 item_id uuid not null,from_warehouse_id uuid,to_warehouse_id uuid,
 quantity numeric(14,3) not null check(quantity>0 and quantity<>'NaN'),unit_cost numeric(14,4) not null check(unit_cost>=0 and unit_cost<>'NaN'),
 kind text not null check(kind in ('receipt','issue','transfer','return','adjustment_in','adjustment_out')),
 asset_id uuid,work_order_id uuid,purchase_id uuid,notes text not null,created_by uuid not null references auth.users,
 created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,ref_no),
 check(from_warehouse_id is distinct from to_warehouse_id),check(from_warehouse_id is not null or to_warehouse_id is not null),
 check((kind='transfer' and from_warehouse_id is not null and to_warehouse_id is not null)
   or (kind in ('receipt','return','adjustment_in') and from_warehouse_id is null and to_warehouse_id is not null)
   or (kind in ('issue','adjustment_out') and from_warehouse_id is not null and to_warehouse_id is null)),
 foreign key(tenant_id,item_id) references inventory_items(tenant_id,id),foreign key(tenant_id,from_warehouse_id) references warehouses(tenant_id,id),
 foreign key(tenant_id,to_warehouse_id) references warehouses(tenant_id,id),foreign key(tenant_id,asset_id) references assets(tenant_id,id),
 foreign key(tenant_id,work_order_id) references work_orders(tenant_id,id),foreign key(tenant_id,purchase_id) references purchase_orders(tenant_id,id));
create table payroll_items(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,employee_id uuid not null,
 period date not null check(extract(day from period)=1),base_amount numeric(14,2) not null check(base_amount>=0 and base_amount<>'NaN'),
 bonus numeric(14,2) not null default 0 check(bonus>=0 and bonus<>'NaN'),deductions numeric(14,2) not null default 0 check(deductions>=0 and deductions<>'NaN'),
 net_amount numeric(14,2) generated always as(base_amount+bonus-deductions) stored,
 status text not null default 'draft' check(status in ('draft','approved','paid')),notes text,
 approved_by uuid references auth.users,paid_on date,unique(tenant_id,id),unique(tenant_id,employee_id,period),
 check(base_amount+bonus>=deductions),foreign key(tenant_id,employee_id) references employees(tenant_id,id));
create table enquiries(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,
 full_name text not null,phone text not null,email text,message text not null,asset_code text,
 status text not null default 'new' check(status in ('new','contacted','qualified','closed')),
 notes text,created_at timestamptz not null default now(),unique(tenant_id,id));
create table audit_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,
 actor_id uuid,table_name text not null,record_id uuid,operation text not null,
 changes jsonb not null,created_at timestamptz not null default now());

create function private.has_role(roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role=any(roles)) $$;
create function private.employee_access(e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.employees e1 join public.profiles p on p.tenant_id=e1.tenant_id and p.id=(select auth.uid())
 where e1.id=e and (p.scope_district_id is null or p.scope_district_id=e1.district_id)) $$;
create function private.employee_self(e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.employees where id=e and tenant_id=public.auth_tenant() and profile_id=(select auth.uid())) $$;
create function private.warehouse_access(w uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.warehouses w1 join public.profiles p on p.tenant_id=w1.tenant_id and p.id=(select auth.uid())
 where w1.id=w and (p.scope_district_id is null or p.scope_district_id=w1.district_id)) $$;
revoke all on function private.has_role(text[]),private.employee_access(uuid),private.employee_self(uuid),private.warehouse_access(uuid) from public;
grant execute on function private.has_role(text[]),private.employee_access(uuid),private.employee_self(uuid),private.warehouse_access(uuid) to authenticated;

do $$ declare t text; predicate text; begin
 foreach t in array array['employees','attendance','leave_requests','warehouses','inventory_items','work_orders','inspections','purchase_orders','purchase_lines','stock_movements','payroll_items','enquiries','audit_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create index on public.%I(tenant_id)',t);
  execute format('create trigger immutable_tenant before update on public.%I for each row execute function private.immutable_tenant()',t);
  predicate:=case t
   when 'employees' then '(private.employee_access(id) and private.has_role(array[''admin'',''hr'',''accountant''])) or private.employee_self(id)'
   when 'attendance' then '(private.employee_access(employee_id) and private.has_role(array[''admin'',''hr''])) or private.employee_self(employee_id)'
   when 'leave_requests' then '(private.employee_access(employee_id) and private.has_role(array[''admin'',''hr''])) or private.employee_self(employee_id)'
   when 'payroll_items' then '(private.employee_access(employee_id) and private.has_role(array[''admin'',''hr'',''accountant''])) or private.employee_self(employee_id)'
   when 'warehouses' then 'private.warehouse_access(id)'
   when 'work_orders' then 'private.asset_access(asset_id)'
   when 'inspections' then 'private.asset_access(asset_id)'
   when 'purchase_orders' then 'private.warehouse_access(warehouse_id)'
   when 'purchase_lines' then 'exists(select 1 from public.purchase_orders o where o.id=purchase_id)'
   when 'stock_movements' then '(from_warehouse_id is not null and private.warehouse_access(from_warehouse_id)) or (to_warehouse_id is not null and private.warehouse_access(to_warehouse_id))'
   when 'enquiries' then 'private.allowed(''sales'')'
   when 'audit_events' then 'public.auth_role()=''admin'''
   else 'true' end;
  execute format('create policy scoped_read on public.%I for select to authenticated using(tenant_id=public.auth_tenant() and (%s))',t,predicate);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
-- Controlled direct inserts use RLS; all lifecycle transitions and ledgers use RPCs.
create policy employee_create on employees for insert to authenticated with check(tenant_id=auth_tenant() and private.in_district(district_id) and private.has_role(array['admin','hr']));
create policy employee_update on employees for update to authenticated using(tenant_id=auth_tenant() and private.employee_access(id) and private.has_role(array['admin','hr'])) with check(tenant_id=auth_tenant() and private.in_district(district_id) and private.has_role(array['admin','hr']));
grant insert,update on employees to authenticated;
create policy warehouse_create on warehouses for insert to authenticated with check(tenant_id=auth_tenant() and private.in_district(district_id) and private.has_role(array['admin','area_manager','storekeeper']));
grant insert on warehouses to authenticated;
create policy item_create on inventory_items for insert to authenticated with check(tenant_id=auth_tenant() and private.has_role(array['admin','storekeeper']));
grant insert on inventory_items to authenticated;
create policy work_create on work_orders for insert to authenticated with check(tenant_id=auth_tenant() and private.asset_access(asset_id) and private.allowed('assets') and created_by=auth.uid() and status in ('open','assigned') and completed_at is null and (assigned_employee_id is null or private.employee_access(assigned_employee_id)));
grant insert on work_orders to authenticated;
create policy payroll_create on payroll_items for insert to authenticated with check(tenant_id=auth_tenant() and private.employee_access(employee_id) and private.has_role(array['admin','hr']) and status='draft' and approved_by is null and paid_on is null);
grant insert on payroll_items to authenticated;

create view v_stock_balances with(security_invoker=true) as
with movements as(
 select tenant_id,item_id,to_warehouse_id warehouse_id,quantity delta,quantity*unit_cost value_delta from stock_movements where to_warehouse_id is not null
 union all select tenant_id,item_id,from_warehouse_id,-quantity,-quantity*unit_cost from stock_movements where from_warehouse_id is not null
)
select m.tenant_id,m.item_id,m.warehouse_id,i.sku,i.name item_name,i.unit,i.reorder_level,w.name warehouse_name,
 sum(delta) quantity,round(sum(value_delta),2) inventory_value,
 case when sum(delta)>0 then round(sum(value_delta)/sum(delta),4) else 0 end average_cost,
 sum(delta)<=i.reorder_level low_stock
from movements m join inventory_items i on i.id=m.item_id join warehouses w on w.id=m.warehouse_id
group by m.tenant_id,m.item_id,m.warehouse_id,i.sku,i.name,i.unit,i.reorder_level,w.name;
grant select on v_stock_balances to authenticated;
revoke all on v_stock_balances from anon;

create function employee_directory() returns table(id uuid,code text,full_name text,department text,job_title text,district_id uuid,status text)
language sql stable security definer set search_path='' as $$
 select e.id,e.code,e.full_name,e.department,e.job_title,e.district_id,e.status from public.employees e
 where e.tenant_id=public.auth_tenant() and private.employee_access(e.id) $$;
revoke all on function employee_directory() from public;
grant execute on function employee_directory() to authenticated;

create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare rowdata jsonb; olddata jsonb; begin
 if tg_op='DELETE' then rowdata:=to_jsonb(old);else rowdata:=to_jsonb(new);end if;
 if tg_op='UPDATE' then olddata:=to_jsonb(old);end if;
 insert into public.audit_events(tenant_id,actor_id,table_name,record_id,operation,changes)
 values((rowdata->>'tenant_id')::uuid,auth.uid(),tg_table_name,(rowdata->>'id')::uuid,tg_op,
 jsonb_build_object('before',olddata,'after',rowdata));
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.audit_change() from public;
do $$ declare t text; begin
 foreach t in array array['employees','attendance','leave_requests','warehouses','inventory_items','work_orders','inspections','purchase_orders','stock_movements','payroll_items','enquiries','customer_contracts','contract_lines','assets','invoices','payments','licenses'] loop
  execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
 end loop;
end $$;
create index on attendance(tenant_id,employee_id,work_date desc);
create index on leave_requests(tenant_id,employee_id,start_date,end_date);
create index on work_orders(tenant_id,asset_id,status);
create index on work_orders(tenant_id,assigned_employee_id);
create index on inspections(tenant_id,asset_id,checked_at desc);
create index on purchase_orders(tenant_id,warehouse_id,status);
create index on purchase_orders(tenant_id,supplier_id);
create index on purchase_lines(tenant_id,purchase_id);
create index on stock_movements(tenant_id,item_id,from_warehouse_id,to_warehouse_id);
create index on stock_movements(tenant_id,asset_id,work_order_id);
create index on audit_events(tenant_id,created_at desc);
create index on enquiries(tenant_id,created_at desc);


-- SOURCE: 20261017165554_accounting_workflows.sql
-- 0008: double-entry ledger, cash/bank books, automatic invoice/payment posting, payroll settlement.

create table ledger_accounts(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,code text not null,name text not null,
 kind text not null check(kind in ('asset','liability','equity','revenue','expense')),active boolean not null default true,
 unique(tenant_id,id),unique(tenant_id,code));
create table cash_accounts(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,name text not null,
 kind text not null check(kind in ('cash','bank')),ledger_account_id uuid not null,allow_overdraft boolean not null default false,
 unique(tenant_id,id),unique(tenant_id,ledger_account_id),foreign key(tenant_id,ledger_account_id) references ledger_accounts(tenant_id,id));
create table journal_entries(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,ref_no text not null,
 entry_date date not null,description text not null,source_kind text not null,source_id uuid not null,
 created_by uuid references auth.users,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,ref_no),unique(tenant_id,source_kind,source_id));
create table journal_lines(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,entry_id uuid not null,account_id uuid not null,
 debit numeric(14,2) not null default 0,credit numeric(14,2) not null default 0,
 check(debit>=0 and credit>=0 and debit<>'NaN' and credit<>'NaN' and ((debit>0 and credit=0) or (credit>0 and debit=0))),
 foreign key(tenant_id,entry_id) references journal_entries(tenant_id,id),foreign key(tenant_id,account_id) references ledger_accounts(tenant_id,id));
create table cash_transactions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,ref_no text not null,
 cash_account_id uuid not null,target_cash_account_id uuid,category_account_id uuid,
 kind text not null check(kind in ('income','expense','transfer','opening','receipt','payment','salary')),
 amount numeric(14,2) not null check(amount>0 and amount<>'NaN'),transaction_date date not null,description text not null,
 asset_id uuid,work_order_id uuid,journal_entry_id uuid not null,created_by uuid not null references auth.users,
 created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,ref_no),
 check((kind='transfer' and target_cash_account_id is not null and target_cash_account_id<>cash_account_id) or (kind<>'transfer' and target_cash_account_id is null)),
 foreign key(tenant_id,cash_account_id) references cash_accounts(tenant_id,id),foreign key(tenant_id,target_cash_account_id) references cash_accounts(tenant_id,id),
 foreign key(tenant_id,category_account_id) references ledger_accounts(tenant_id,id),foreign key(tenant_id,journal_entry_id) references journal_entries(tenant_id,id),
 foreign key(tenant_id,asset_id) references assets(tenant_id,id),foreign key(tenant_id,work_order_id) references work_orders(tenant_id,id));
alter table invoices add column journal_entry_id uuid,add column category_account_id uuid,
 add foreign key(tenant_id,journal_entry_id) references journal_entries(tenant_id,id),add foreign key(tenant_id,category_account_id) references ledger_accounts(tenant_id,id);
alter table payments add column cash_account_id uuid,add column journal_entry_id uuid,
 add foreign key(tenant_id,cash_account_id) references cash_accounts(tenant_id,id),add foreign key(tenant_id,journal_entry_id) references journal_entries(tenant_id,id);
alter table payroll_items add column approval_journal_id uuid,add column payment_journal_id uuid,
 add foreign key(tenant_id,approval_journal_id) references journal_entries(tenant_id,id),add foreign key(tenant_id,payment_journal_id) references journal_entries(tenant_id,id);

create function private.initialize_finance() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.ledger_accounts(tenant_id,code,name,kind)
 select new.id,code,name,kind from (values
 ('1000','الخزينة النقدية','asset'),('1010','الحساب البنكي','asset'),('1100','ذمم المعلنين','asset'),('1400','مخزون المعدات','asset'),
 ('2000','ذمم الوطنية والموردين','liability'),('2100','رواتب مستحقة','liability'),('2200','بضاعة مستلمة لم تفوتر','liability'),('3000','الأرصدة الافتتاحية وحقوق الملكية','equity'),
 ('4000','إيراد الإعلانات','revenue'),('4100','إيرادات أخرى','revenue'),('5000','مصروفات تشغيلية','expense'),
 ('5100','مصروف الرواتب','expense'),('5200','مصروف الصيانة','expense'),('5300','تكلفة الاستغلال والإيجار','expense'),('4200','زيادة جرد المخزون','revenue'),('5400','عجز جرد المخزون','expense')) x(code,name,kind)
 on conflict(tenant_id,code) do nothing;
 insert into public.cash_accounts(tenant_id,name,kind,ledger_account_id)
 select new.id,name,case code when '1000' then 'cash' else 'bank' end,id from public.ledger_accounts where tenant_id=new.id and code in ('1000','1010')
 on conflict(tenant_id,ledger_account_id) do nothing;
 return new;
end $$;
revoke all on function private.initialize_finance() from public;
create trigger initialize_finance after insert on tenants for each row execute function private.initialize_finance();
-- Seed account definitions for pre-existing tenants without assuming opening balances or payment methods.
insert into ledger_accounts(tenant_id,code,name,kind)
select t.id,x.code,x.name,x.kind from tenants t cross join (values
 ('1000','الخزينة النقدية','asset'),('1010','الحساب البنكي','asset'),('1100','ذمم المعلنين','asset'),('1400','مخزون المعدات','asset'),
 ('2000','ذمم الوطنية والموردين','liability'),('2100','رواتب مستحقة','liability'),('2200','بضاعة مستلمة لم تفوتر','liability'),('3000','الأرصدة الافتتاحية وحقوق الملكية','equity'),
 ('4000','إيراد الإعلانات','revenue'),('4100','إيرادات أخرى','revenue'),('5000','مصروفات تشغيلية','expense'),
 ('5100','مصروف الرواتب','expense'),('5200','مصروف الصيانة','expense'),('5300','تكلفة الاستغلال والإيجار','expense'),('4200','زيادة جرد المخزون','revenue'),('5400','عجز جرد المخزون','expense')) x(code,name,kind)
on conflict(tenant_id,code) do nothing;
insert into cash_accounts(tenant_id,name,kind,ledger_account_id)
select tenant_id,name,case code when '1000' then 'cash' else 'bank' end,id from ledger_accounts where code in ('1000','1010')
on conflict(tenant_id,ledger_account_id) do nothing;

do $$ declare t text; begin
 foreach t in array array['ledger_accounts','cash_accounts','journal_entries','journal_lines','cash_transactions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create index on public.%I(tenant_id)',t);
  execute format('create trigger immutable_tenant before update on public.%I for each row execute function private.immutable_tenant()',t);
  execute format('create policy finance_read on public.%I for select to authenticated using(tenant_id=public.auth_tenant() and private.allowed(''finance'') and (private.profile()).scope_district_id is null)',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create index on journal_lines(tenant_id,entry_id);
create index on journal_lines(tenant_id,account_id);
create index on journal_entries(tenant_id,entry_date);
create index on cash_transactions(tenant_id,cash_account_id,transaction_date);
create index on cash_transactions(tenant_id,work_order_id);

create function private.balance_journal() returns trigger language plpgsql security definer set search_path='' as $$
declare e uuid; begin
 if tg_table_name='journal_entries' then e:=new.id;else e:=new.entry_id;end if;
 if (select count(*)<2 or coalesce(sum(debit-credit),0)<>0 from public.journal_lines where entry_id=e) then raise exception 'UNBALANCED_JOURNAL';end if;
 return new;
end $$;
revoke all on function private.balance_journal() from public;
create constraint trigger balanced_entry after insert on journal_entries deferrable initially deferred for each row execute function private.balance_journal();
create constraint trigger balanced_lines after insert or update on journal_lines deferrable initially deferred for each row execute function private.balance_journal();

create function private.post_journal(t uuid,ref text,day date,descr text,source text,sourceid uuid,lines jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare e uuid:=gen_random_uuid(); l jsonb; begin
 if day is null or jsonb_array_length(lines)<2 then raise exception 'INVALID_JOURNAL';end if;
 insert into public.journal_entries(id,tenant_id,ref_no,entry_date,description,source_kind,source_id,created_by)
 values(e,t,ref,day,descr,source,sourceid,auth.uid());
 for l in select value from jsonb_array_elements(lines) loop
  if not exists(select 1 from public.ledger_accounts a where a.id=(l->>'account')::uuid and a.tenant_id=t and a.active) then raise exception 'INVALID_ACCOUNT';end if;
  insert into public.journal_lines(tenant_id,entry_id,account_id,debit,credit)
  values(t,e,(l->>'account')::uuid,coalesce((l->>'debit')::numeric,0),coalesce((l->>'credit')::numeric,0));
 end loop;return e;
end $$;
revoke all on function private.post_journal(uuid,text,date,text,text,uuid,jsonb) from public,anon,authenticated;

create view v_cash_balances with(security_invoker=true) as
select a.tenant_id,a.id,a.name,a.kind,a.ledger_account_id,a.allow_overdraft,coalesce(sum(l.debit-l.credit),0) balance
from cash_accounts a left join journal_lines l on l.account_id=a.ledger_account_id
group by a.tenant_id,a.id,a.name,a.kind,a.ledger_account_id,a.allow_overdraft;
create view v_trial_balance with(security_invoker=true) as
select a.tenant_id,a.id,a.code,a.name,a.kind,coalesce(sum(l.debit),0) debit,coalesce(sum(l.credit),0) credit,coalesce(sum(l.debit-l.credit),0) balance
from ledger_accounts a left join journal_lines l on l.account_id=a.id group by a.tenant_id,a.id,a.code,a.name,a.kind;
create view v_monthly_cashflow with(security_invoker=true) as
select tenant_id,date_trunc('month',transaction_date)::date as "month",
 coalesce(sum(amount) filter(where kind in ('income','receipt')),0) income,
 coalesce(sum(amount) filter(where kind in ('expense','payment','salary')),0) expense
from cash_transactions where kind not in ('opening','transfer') group by tenant_id,date_trunc('month',transaction_date);
grant select on v_cash_balances,v_trial_balance,v_monthly_cashflow to authenticated;
revoke all on v_cash_balances,v_trial_balance,v_monthly_cashflow from anon;

create function private.cash_can_spend(c uuid,t uuid,amount numeric,day date) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.cash_accounts a where a.id=c and a.tenant_id=t and
 (a.allow_overdraft or coalesce((select sum(l.debit-l.credit) from public.journal_lines l join public.journal_entries e on e.id=l.entry_id
 where l.account_id=a.ledger_account_id and e.entry_date<=day),0)>=amount)) $$;
revoke all on function private.cash_can_spend(uuid,uuid,numeric,date) from public,anon,authenticated;

create function private.invoice_posting() returns trigger language plpgsql security definer set search_path='' as $$
declare debit_account uuid;credit_account uuid;begin
 if new.direction='receivable' then
  select id into debit_account from public.ledger_accounts where tenant_id=new.tenant_id and code='1100';
  select id into credit_account from public.ledger_accounts where tenant_id=new.tenant_id and kind='revenue' and (id=new.category_account_id or (new.category_account_id is null and code='4000'));
 else
  select id into debit_account from public.ledger_accounts where tenant_id=new.tenant_id and kind in ('expense','asset') and (id=new.category_account_id or (new.category_account_id is null and code='5300'));
  select id into credit_account from public.ledger_accounts where tenant_id=new.tenant_id and code='2000';
 end if;
 if debit_account is null or credit_account is null then raise exception 'INVALID_ACCOUNT';end if;
 new.journal_entry_id:=private.post_journal(new.tenant_id,'INV/'||new.id,coalesce(new.created_at,now())::date,'فاتورة '||new.ref_no,'invoice',new.id,
 jsonb_build_array(jsonb_build_object('account',debit_account,'debit',new.amount),jsonb_build_object('account',credit_account,'credit',new.amount)));
 return new;
end $$;
revoke all on function private.invoice_posting() from public;
create trigger invoice_posting before insert on invoices for each row execute function private.invoice_posting();

create function record_invoice_payment(p_invoice_id uuid,p_amount numeric,p_paid_on date,p_reference text,p_cash_account_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare inv public.invoices;paid numeric;result uuid:=gen_random_uuid();cash uuid;contra uuid;e uuid;t uuid:=public.auth_tenant();begin
 if not private.allowed('finance') then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,0));
 select * into inv from public.invoices where id=p_invoice_id and tenant_id=t for update;
 if inv.id is null then raise exception 'INVOICE_NOT_FOUND';end if;
 if not (private.contract_access(inv.contract_id) or (inv.contract_id is null and (private.profile()).scope_district_id is null)) then raise exception 'FORBIDDEN';end if;
 select coalesce(sum(amount),0) into paid from public.payments where invoice_id=inv.id;
 if p_amount is null or p_amount<=0 or p_amount>inv.amount-paid or p_amount='NaN'::numeric then raise exception 'INVALID_PAYMENT';end if;
 select ledger_account_id into cash from public.cash_accounts where id=p_cash_account_id and tenant_id=t;
 if cash is null then raise exception 'CASH_ACCOUNT_REQUIRED';end if;
 if inv.direction='payable' and not private.cash_can_spend(p_cash_account_id,t,p_amount,p_paid_on) then raise exception 'INSUFFICIENT_CASH';end if;
 select id into contra from public.ledger_accounts where tenant_id=t and code=case inv.direction when 'receivable' then '1100' else '2000' end;
 e:=private.post_journal(t,'PAY/'||result,p_paid_on,'سداد فاتورة '||inv.ref_no,'payment',result,
 case inv.direction when 'receivable' then jsonb_build_array(jsonb_build_object('account',cash,'debit',p_amount),jsonb_build_object('account',contra,'credit',p_amount))
 else jsonb_build_array(jsonb_build_object('account',contra,'debit',p_amount),jsonb_build_object('account',cash,'credit',p_amount)) end);
 insert into public.payments(id,tenant_id,invoice_id,amount,paid_on,reference,created_by,cash_account_id,journal_entry_id)
 values(result,t,inv.id,p_amount,p_paid_on,p_reference,auth.uid(),p_cash_account_id,e);
 insert into public.cash_transactions(tenant_id,ref_no,cash_account_id,kind,amount,transaction_date,description,journal_entry_id,created_by)
 values(t,'PAY/'||result,p_cash_account_id,case inv.direction when 'receivable' then 'receipt' else 'payment' end,p_amount,p_paid_on,'سداد '||inv.ref_no,e,auth.uid());
 return result;
end $$;
revoke all on function record_invoice_payment(uuid,numeric,date,text,uuid) from public;
grant execute on function record_invoice_payment(uuid,numeric,date,text,uuid) to authenticated;
-- Preserve the existing SQL API; legacy callers explicitly default to the tenant's cash till.
create or replace function record_payment(p_invoice_id uuid,p_amount numeric,p_paid_on date,p_reference text) returns uuid
language plpgsql security definer set search_path='' as $$ declare c uuid;begin
 select a.id into c from public.cash_accounts a join public.ledger_accounts l on l.id=a.ledger_account_id where a.tenant_id=public.auth_tenant() and l.code='1000';
 return public.record_invoice_payment(p_invoice_id,p_amount,p_paid_on,p_reference,c);end $$;

create function create_cash_transaction(p_kind text,p_ref text,p_cash uuid,p_target uuid,p_category uuid,p_amount numeric,p_date date,p_description text,p_asset uuid default null,p_work uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();cash uuid;contra uuid;e uuid;r uuid:=gen_random_uuid();begin
 if not private.allowed('finance') or (private.profile()).scope_district_id is not null then raise exception 'FORBIDDEN';end if;
 if p_kind not in ('income','expense','transfer','opening') or p_amount is null or p_amount<=0 or p_amount='NaN'::numeric then raise exception 'INVALID_CASH_TRANSACTION';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,0));
 select ledger_account_id into cash from public.cash_accounts where id=p_cash and tenant_id=t;
 if cash is null then raise exception 'CASH_ACCOUNT_REQUIRED';end if;
 if p_asset is not null and not private.asset_access(p_asset) then raise exception 'ASSET_OUT_OF_SCOPE';end if;
 if p_work is not null and not exists(select 1 from public.work_orders where id=p_work and tenant_id=t and (p_asset is null or asset_id=p_asset)) then raise exception 'INVALID_WORK_ORDER';end if;
 if p_kind='transfer' then
  if p_target=p_cash then raise exception 'INVALID_TRANSFER';end if;
  select ledger_account_id into contra from public.cash_accounts where id=p_target and tenant_id=t;
 elsif p_kind='opening' then
  if public.auth_role()<>'admin' or exists(select 1 from public.journal_lines where account_id=cash) then raise exception 'OPENING_BALANCE_ALREADY_USED';end if;
  select id into contra from public.ledger_accounts where tenant_id=t and code='3000';
 else
  select id into contra from public.ledger_accounts where id=p_category and tenant_id=t and active and kind=case p_kind when 'income' then 'revenue' else 'expense' end;
 end if;
 if contra is null then raise exception 'INVALID_ACCOUNT';end if;
 if p_kind in ('expense','transfer') and not private.cash_can_spend(p_cash,t,p_amount,p_date) then raise exception 'INSUFFICIENT_CASH';end if;
 e:=private.post_journal(t,'CASH/'||r,p_date,p_description,'cash',r,
 case when p_kind in ('income','opening') then jsonb_build_array(jsonb_build_object('account',cash,'debit',p_amount),jsonb_build_object('account',contra,'credit',p_amount))
 else jsonb_build_array(jsonb_build_object('account',contra,'debit',p_amount),jsonb_build_object('account',cash,'credit',p_amount)) end);
 insert into public.cash_transactions(id,tenant_id,ref_no,cash_account_id,target_cash_account_id,category_account_id,kind,amount,transaction_date,description,asset_id,work_order_id,journal_entry_id,created_by)
 values(r,t,p_ref,p_cash,case when p_kind='transfer' then p_target end,case when p_kind in ('income','expense') then p_category end,p_kind,p_amount,p_date,p_description,p_asset,p_work,e,auth.uid());
 return r;
end $$;
revoke all on function create_cash_transaction(text,text,uuid,uuid,uuid,numeric,date,text,uuid,uuid) from public;
grant execute on function create_cash_transaction(text,text,uuid,uuid,uuid,numeric,date,text,uuid,uuid) to authenticated;

create function settle_payroll(p_id uuid,p_action text,p_cash uuid default null,p_date date default current_date) returns void
language plpgsql security definer set search_path='' as $$
declare p public.payroll_items;t uuid:=public.auth_tenant();expense uuid;payable uuid;cash uuid;e uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(t::text,0));
 select * into p from public.payroll_items where id=p_id and tenant_id=t for update;
 if p.id is null or not private.employee_access(p.employee_id) then raise exception 'FORBIDDEN';end if;
 if p.net_amount<=0 then raise exception 'INVALID_PAYROLL_AMOUNT';end if;
 select id into payable from public.ledger_accounts where tenant_id=t and code='2100';
 if p_action='approve' then
  if not private.has_role(array['admin','hr']) or p.status<>'draft' then raise exception 'INVALID_PAYROLL_TRANSITION';end if;
  select id into expense from public.ledger_accounts where tenant_id=t and code='5100';
  e:=private.post_journal(t,'SALARY/'||p.id,p.period,'استحقاق راتب','payroll_accrual',p.id,jsonb_build_array(jsonb_build_object('account',expense,'debit',p.net_amount),jsonb_build_object('account',payable,'credit',p.net_amount)));
  update public.payroll_items set status='approved',approved_by=auth.uid(),approval_journal_id=e where id=p.id;
 elsif p_action='pay' then
  if not private.allowed('finance') or p.status<>'approved' then raise exception 'INVALID_PAYROLL_TRANSITION';end if;
  select ledger_account_id into cash from public.cash_accounts where id=p_cash and tenant_id=t;
  if cash is null or not private.cash_can_spend(p_cash,t,p.net_amount,p_date) then raise exception 'INSUFFICIENT_CASH';end if;
  e:=private.post_journal(t,'SALARY-PAY/'||p.id,p_date,'صرف راتب','payroll_payment',p.id,jsonb_build_array(jsonb_build_object('account',payable,'debit',p.net_amount),jsonb_build_object('account',cash,'credit',p.net_amount)));
  update public.payroll_items set status='paid',paid_on=p_date,payment_journal_id=e where id=p.id;
  insert into public.cash_transactions(tenant_id,ref_no,cash_account_id,kind,amount,transaction_date,description,journal_entry_id,created_by)
  values(t,'SALARY/'||p.id,p_cash,'salary',p.net_amount,p_date,'صرف راتب',e,auth.uid());
 else raise exception 'INVALID_ACTION';end if;
end $$;
revoke all on function settle_payroll(uuid,text,uuid,date) from public;
grant execute on function settle_payroll(uuid,text,uuid,date) to authenticated;


-- SOURCE: 20261017165556_operational_workflows.sql
-- 0009: transactional stock, purchasing, HR, maintenance and customer workflows.

alter table stock_movements add column return_of uuid,add column journal_entry_id uuid,
 add foreign key(tenant_id,return_of) references stock_movements(tenant_id,id),add foreign key(tenant_id,journal_entry_id) references journal_entries(tenant_id,id);
alter table invoices add column purchase_id uuid,add foreign key(tenant_id,purchase_id) references purchase_orders(tenant_id,id);
create unique index invoices_purchase_once on invoices(tenant_id,purchase_id) where purchase_id is not null;
alter table leave_requests add column period daterange generated always as(daterange(start_date,end_date,'[]')) stored,
 add exclude using gist(employee_id with =,period with &&) where(status='approved');

create function move_stock(p_kind text,p_ref text,p_item uuid,p_from uuid,p_to uuid,p_quantity numeric,p_cost numeric,p_notes text,p_asset uuid default null,p_work uuid default null,p_return uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();qty numeric;val numeric;cost numeric:=p_cost;r uuid;original public.stock_movements;asset uuid:=p_asset;begin
 if not private.has_role(array['admin','storekeeper','area_manager']) then raise exception 'FORBIDDEN';end if;
 if p_quantity is null or p_quantity<=0 or p_quantity='NaN'::numeric then raise exception 'INVALID_QUANTITY';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,0));
 if (p_from is not null and not private.warehouse_access(p_from)) or (p_to is not null and not private.warehouse_access(p_to)) then raise exception 'WAREHOUSE_OUT_OF_SCOPE';end if;
 if not exists(select 1 from public.inventory_items where id=p_item and tenant_id=t and active) then raise exception 'INVALID_ITEM';end if;
 if p_from is not null then
  select coalesce(sum(delta),0),coalesce(sum(delta*unit_cost),0) into qty,val from(
   select quantity delta,unit_cost from public.stock_movements where tenant_id=t and item_id=p_item and to_warehouse_id=p_from
   union all select -quantity,unit_cost from public.stock_movements where tenant_id=t and item_id=p_item and from_warehouse_id=p_from) q;
  if qty<p_quantity then raise exception 'INSUFFICIENT_STOCK';end if;
  cost:=round(val/nullif(qty,0),4);
 end if;
 if p_kind='return' then
  select * into original from public.stock_movements where id=p_return and tenant_id=t and kind='issue';
  if original.id is null or original.item_id<>p_item or not private.warehouse_access(original.from_warehouse_id) or p_quantity>(original.quantity-coalesce((select sum(quantity) from public.stock_movements where return_of=p_return),0)) then raise exception 'INVALID_STOCK_RETURN';end if;
  cost:=original.unit_cost;asset:=original.asset_id;
 elsif p_return is not null then raise exception 'INVALID_STOCK_RETURN';end if;
 if asset is not null and not private.asset_access(asset) then raise exception 'ASSET_OUT_OF_SCOPE';end if;
 if p_work is not null then
  select asset_id into asset from public.work_orders where id=p_work and tenant_id=t and status not in ('completed','cancelled');
  if asset is null or not private.asset_access(asset) or (p_asset is not null and asset<>p_asset) then raise exception 'INVALID_WORK_ORDER';end if;
 end if;
 if length(trim(p_notes))<3 then raise exception 'REASON_REQUIRED';end if;
 insert into public.stock_movements(tenant_id,ref_no,item_id,from_warehouse_id,to_warehouse_id,quantity,unit_cost,kind,asset_id,work_order_id,notes,created_by,return_of)
 values(t,p_ref,p_item,p_from,p_to,p_quantity,cost,p_kind,asset,p_work,p_notes,auth.uid(),p_return) returning id into r;
 return r;
end $$;
revoke all on function move_stock(text,text,uuid,uuid,uuid,numeric,numeric,text,uuid,uuid,uuid) from public;
grant execute on function move_stock(text,text,uuid,uuid,uuid,numeric,numeric,text,uuid,uuid,uuid) to authenticated;

create function private.post_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare inv uuid;contra uuid;amount numeric:=round(new.quantity*new.unit_cost,2);begin
 if new.kind='transfer' or amount=0 then return new;end if;
 select id into inv from public.ledger_accounts where tenant_id=new.tenant_id and code='1400';
 select id into contra from public.ledger_accounts where tenant_id=new.tenant_id and code=case
 when new.kind='receipt' and new.purchase_id is not null then '2200' when new.kind='receipt' then '3000'
 when new.kind='adjustment_in' then '4200' when new.kind='adjustment_out' then '5400' else '5200' end;
 new.journal_entry_id:=private.post_journal(new.tenant_id,'STOCK/'||new.id,(new.created_at at time zone 'Africa/Cairo')::date,new.notes,'stock',new.id,
 case when new.kind in ('receipt','return','adjustment_in') then jsonb_build_array(jsonb_build_object('account',inv,'debit',amount),jsonb_build_object('account',contra,'credit',amount))
 else jsonb_build_array(jsonb_build_object('account',contra,'debit',amount),jsonb_build_object('account',inv,'credit',amount)) end);
 return new;
end $$;
revoke all on function private.post_stock() from public;
create trigger post_stock before insert on stock_movements for each row execute function private.post_stock();

create function create_purchase(p_ref text,p_supplier uuid,p_warehouse uuid,p_date date,p_expected date,p_lines jsonb,p_notes text) returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();r uuid:=gen_random_uuid();l jsonb;begin
 if not private.has_role(array['admin','storekeeper','area_manager']) or not private.warehouse_access(p_warehouse) then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.parties where tenant_id=t and id=p_supplier and type='supplier') then raise exception 'INVALID_SUPPLIER';end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 200 then raise exception 'INVALID_LINES';end if;
 insert into public.purchase_orders(id,tenant_id,ref_no,supplier_id,warehouse_id,ordered_on,expected_on,notes,created_by)
 values(r,t,p_ref,p_supplier,p_warehouse,p_date,p_expected,p_notes,auth.uid());
 for l in select value from jsonb_array_elements(p_lines) loop
  insert into public.purchase_lines(tenant_id,purchase_id,item_id,quantity,unit_cost)
  values(t,r,(l->>'item_id')::uuid,(l->>'quantity')::numeric,(l->>'unit_cost')::numeric);
 end loop;return r;
end $$;
create function receive_purchase(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.purchase_orders;l public.purchase_lines;t uuid:=public.auth_tenant();begin
 if not private.has_role(array['admin','storekeeper','area_manager']) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,0));
 select * into p from public.purchase_orders where id=p_id and tenant_id=t for update;
 if p.id is null or not private.warehouse_access(p.warehouse_id) then raise exception 'FORBIDDEN';end if;
 if p.status<>'ordered' then raise exception 'PURCHASE_ALREADY_PROCESSED';end if;
 for l in select * from public.purchase_lines where purchase_id=p.id loop
  insert into public.stock_movements(tenant_id,ref_no,item_id,to_warehouse_id,quantity,unit_cost,kind,purchase_id,notes,created_by)
  values(t,'PO/'||l.id,l.item_id,p.warehouse_id,l.quantity,l.unit_cost,'receipt',p.id,'استلام أمر شراء '||p.ref_no,auth.uid());
 end loop;
 update public.purchase_orders set status='received',received_at=now() where id=p.id;
end $$;
create function invoice_purchase(p_id uuid,p_ref text,p_due date) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.purchase_orders;t uuid:=public.auth_tenant();r uuid;a uuid;amount numeric;begin
 if not private.allowed('finance') or (private.profile()).scope_district_id is not null then raise exception 'FORBIDDEN';end if;
 select * into p from public.purchase_orders where id=p_id and tenant_id=t for update;
 if p.id is null or p.status<>'received' then raise exception 'PURCHASE_NOT_RECEIVED';end if;
 select sum(quantity*unit_cost) into amount from public.purchase_lines where purchase_id=p.id;
 select id into a from public.ledger_accounts where tenant_id=t and code='2200';
 insert into public.invoices(tenant_id,ref_no,party_id,direction,amount,due_date,purchase_id,category_account_id)
 values(t,p_ref,p.supplier_id,'payable',amount,p_due,p.id,a) returning id into r;return r;
end $$;
revoke all on function create_purchase(text,uuid,uuid,date,date,jsonb,text),receive_purchase(uuid),invoice_purchase(uuid,text,date) from public;
grant execute on function create_purchase(text,uuid,uuid,date,date,jsonb,text),receive_purchase(uuid),invoice_purchase(uuid,text,date) to authenticated;
-- Goods-received clearing is a liability debit when the supplier invoice arrives.
create or replace function private.invoice_posting() returns trigger language plpgsql security definer set search_path='' as $$
declare debit_account uuid;credit_account uuid;begin
 if new.direction='receivable' then
  select id into debit_account from public.ledger_accounts where tenant_id=new.tenant_id and code='1100';
  select id into credit_account from public.ledger_accounts where tenant_id=new.tenant_id and kind='revenue' and (id=new.category_account_id or (new.category_account_id is null and code='4000'));
 else
  select id into debit_account from public.ledger_accounts where tenant_id=new.tenant_id and (kind in ('expense','asset') or (code='2200' and new.purchase_id is not null)) and (id=new.category_account_id or (new.category_account_id is null and code='5300'));
  select id into credit_account from public.ledger_accounts where tenant_id=new.tenant_id and code='2000';
 end if;
 if debit_account is null or credit_account is null then raise exception 'INVALID_ACCOUNT';end if;
 new.journal_entry_id:=private.post_journal(new.tenant_id,'INV/'||new.id,(coalesce(new.created_at,now()) at time zone 'Africa/Cairo')::date,'فاتورة '||new.ref_no,'invoice',new.id,
 jsonb_build_array(jsonb_build_object('account',debit_account,'debit',new.amount),jsonb_build_object('account',credit_account,'credit',new.amount)));
 return new;
end $$;

create function clock_attendance(p_employee uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();day date;begin
 if not private.employee_access(p_employee) or not (private.employee_self(p_employee) or private.has_role(array['admin','hr'])) then raise exception 'FORBIDDEN';end if;
 select (now() at time zone timezone)::date into day from public.tenants where id=t;
 if p_action='in' then
  if exists(select 1 from public.attendance where tenant_id=t and employee_id=p_employee and check_out is null) then raise exception 'ATTENDANCE_ALREADY_OPEN';end if;
  insert into public.attendance(tenant_id,employee_id,work_date,check_in,recorded_by) values(t,p_employee,day,now(),auth.uid());
 elsif p_action='out' then
  update public.attendance set check_out=now() where id=(select id from public.attendance where tenant_id=t and employee_id=p_employee and check_out is null order by check_in desc limit 1);
  if not found then raise exception 'NO_OPEN_ATTENDANCE';end if;
 else raise exception 'INVALID_ACTION';end if;
end $$;
create function manual_attendance(p_employee uuid,p_day date,p_in time,p_out time,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();tz text;tin timestamptz;tout timestamptz;begin
 if not private.has_role(array['admin','hr']) or not private.employee_access(p_employee) then raise exception 'FORBIDDEN';end if;
 if length(trim(p_reason))<5 then raise exception 'REASON_REQUIRED';end if;
 select timezone into tz from public.tenants where id=t;
 tin:=(p_day+p_in) at time zone tz;
 tout:=(p_day+p_out+case when p_out<p_in then interval '1 day' else interval '0' end) at time zone tz;
 if tin>now() or tout>now() then raise exception 'FUTURE_ATTENDANCE';end if;
 insert into public.attendance(tenant_id,employee_id,work_date,check_in,check_out,recorded_by,notes)
 values(t,p_employee,p_day,tin,tout,auth.uid(),p_reason)
 on conflict(tenant_id,employee_id,work_date) do update set check_in=excluded.check_in,check_out=excluded.check_out,notes=excluded.notes,recorded_by=excluded.recorded_by;
end $$;
create function request_leave(p_employee uuid,p_start date,p_end date,p_kind text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$ declare r uuid;begin
 if not private.employee_access(p_employee) or not (private.employee_self(p_employee) or private.has_role(array['admin','hr'])) then raise exception 'FORBIDDEN';end if;
 insert into public.leave_requests(tenant_id,employee_id,start_date,end_date,kind,reason) values(public.auth_tenant(),p_employee,p_start,p_end,p_kind,p_reason) returning id into r;return r;
end $$;
create function decide_leave(p_id uuid,p_approve boolean,p_note text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.has_role(array['admin','hr']) then raise exception 'FORBIDDEN';end if;
 update public.leave_requests set status=case when p_approve then 'approved' else 'rejected' end,decided_by=auth.uid(),decision_note=p_note
 where id=p_id and tenant_id=public.auth_tenant() and private.employee_access(employee_id) and status='pending';
 if not found then raise exception 'LEAVE_NOT_PENDING';end if;
end $$;
revoke all on function clock_attendance(uuid,text),manual_attendance(uuid,date,time,time,text),request_leave(uuid,date,date,text,text),decide_leave(uuid,boolean,text) from public;
grant execute on function clock_attendance(uuid,text),manual_attendance(uuid,date,time,time,text),request_leave(uuid,date,date,text,text),decide_leave(uuid,boolean,text) to authenticated;

create function progress_work_order(p_id uuid,p_status text,p_resolution text) returns void language plpgsql security definer set search_path='' as $$
declare w public.work_orders;begin
 select * into w from public.work_orders where id=p_id and tenant_id=public.auth_tenant() for update;
 if w.id is null or not private.asset_access(w.asset_id) or not (private.allowed('assets') or private.employee_self(w.assigned_employee_id)) then raise exception 'FORBIDDEN';end if;
 if not ((w.status in ('open','assigned') and p_status in ('in_progress','cancelled')) or (w.status='in_progress' and p_status in ('completed','cancelled'))) then raise exception 'INVALID_WORK_TRANSITION';end if;
 if p_status in ('completed','cancelled') and length(trim(p_resolution))<5 then raise exception 'REASON_REQUIRED';end if;
 update public.work_orders set status=p_status,resolution=p_resolution,completed_at=case when p_status='completed' then now() end where id=w.id;
end $$;
create function record_inspection(p_asset uuid,p_condition text,p_method text,p_tag text,p_notes text,p_lat double precision default null,p_lng double precision default null) returns uuid
language plpgsql security definer set search_path='' as $$ declare r uuid;t uuid:=public.auth_tenant();begin
 if not private.allowed('incidents') or not private.asset_access(p_asset) then raise exception 'FORBIDDEN';end if;
 if p_method in ('qr','nfc') and not exists(select 1 from public.asset_tags where tenant_id=t and asset_id=p_asset and uid=p_tag and active and kind=p_method) then raise exception 'INVALID_ASSET_TAG';end if;
 insert into public.inspections(tenant_id,asset_id,inspector_id,condition,method,tag_uid,notes,latitude,longitude)
 values(t,p_asset,auth.uid(),p_condition,p_method,p_tag,p_notes,p_lat,p_lng) returning id into r;
 if p_condition<>'good' then
  insert into public.asset_incidents(tenant_id,asset_id,kind,description,severity) values(t,p_asset,p_condition,p_notes,case when p_condition='missing' then 3 else 2 end);
 end if;return r;
end $$;
revoke all on function progress_work_order(uuid,text,text),record_inspection(uuid,text,text,text,text,double precision,double precision) from public;
grant execute on function progress_work_order(uuid,text,text),record_inspection(uuid,text,text,text,text,double precision,double precision) to authenticated;

create function cancel_customer_contract(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.allowed('sales') or not private.contract_access(p_id) or length(trim(p_reason))<5 then raise exception 'FORBIDDEN_OR_REASON_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(public.auth_tenant()::text,0));
 update public.contract_lines set status='cancelled' where contract_id=p_id and tenant_id=public.auth_tenant();
 update public.customer_contracts set status='cancelled' where id=p_id and tenant_id=public.auth_tenant();
 insert into public.audit_events(tenant_id,actor_id,table_name,record_id,operation,changes)
 values(public.auth_tenant(),auth.uid(),'customer_contracts',p_id,'CANCEL_REASON',jsonb_build_object('reason',p_reason));
end $$;
revoke all on function cancel_customer_contract(uuid,text) from public;
grant execute on function cancel_customer_contract(uuid,text) to authenticated;

create function submit_enquiry(p_host text,p_name text,p_phone text,p_email text,p_message text,p_asset_code text default null) returns void
language plpgsql security definer set search_path='' as $$ declare t uuid;begin
 select td.tenant_id into t from public.tenant_domains td join public.tenants te on te.id=td.tenant_id where td.domain=lower(p_host) and td.verified and te.public_site_enabled;
 if t is null or length(trim(p_name)) not between 2 and 150 or length(p_phone) not between 8 and 25 or length(p_message) not between 5 and 2000 then raise exception 'INVALID_ENQUIRY';end if;
 perform pg_advisory_xact_lock(hashtextextended('enquiry:'||t::text,0));
 if (select count(*) from public.enquiries where tenant_id=t and created_at>now()-interval '1 day')>=100 or
 (select count(*) from public.enquiries where tenant_id=t and phone=p_phone and created_at>now()-interval '1 day')>=3 then raise exception 'ENQUIRY_RATE_LIMIT';end if;
 insert into public.enquiries(tenant_id,full_name,phone,email,message,asset_code) values(t,trim(p_name),p_phone,left(p_email,200),p_message,p_asset_code);
end $$;
create function update_enquiry(p_id uuid,p_status text,p_notes text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.allowed('sales') then raise exception 'FORBIDDEN';end if;
 update public.enquiries set status=p_status,notes=p_notes where id=p_id and tenant_id=public.auth_tenant();
 if not found then raise exception 'ENQUIRY_NOT_FOUND';end if;
end $$;
revoke all on function submit_enquiry(text,text,text,text,text,text),update_enquiry(uuid,text,text) from public;
grant execute on function submit_enquiry(text,text,text,text,text,text) to anon,authenticated;
grant execute on function update_enquiry(uuid,text,text) to authenticated;

-- Activate new modules for existing companies, without enabling external messaging.
insert into tenant_modules(tenant_id,module_key,enabled)
select t.id,k,true from tenants t cross join unnest(array['employees','attendance','payroll','inventory','purchases','maintenance','inspections','cashbook','reports','leads','audit']) k on conflict do nothing;


-- SOURCE: 20261017170246_operational_settings_schedules.sql
-- 0010: account configuration, installments, operational safeguards, tenant reminder queue.

create function create_ledger_account(p_code text,p_name text,p_kind text) returns uuid language plpgsql security definer set search_path='' as $$ declare r uuid;begin
 if not private.allowed('finance') or (private.profile()).scope_district_id is not null then raise exception 'FORBIDDEN';end if;
 insert into public.ledger_accounts(tenant_id,code,name,kind) values(public.auth_tenant(),p_code,p_name,p_kind) returning id into r;return r;
end $$;
create function create_cash_account(p_code text,p_name text,p_kind text) returns uuid language plpgsql security definer set search_path='' as $$ declare a uuid;r uuid;begin
 if public.auth_role() is distinct from 'admin' then raise exception 'FORBIDDEN';end if;
 insert into public.ledger_accounts(tenant_id,code,name,kind) values(public.auth_tenant(),p_code,p_name,'asset') returning id into a;
 insert into public.cash_accounts(tenant_id,name,kind,ledger_account_id) values(public.auth_tenant(),p_name,p_kind,a) returning id into r;return r;
end $$;
create function queue_tenant_reminders() returns int language plpgsql security definer set search_path='' as $$ declare n int;begin
 if public.auth_role() is distinct from 'admin' then raise exception 'FORBIDDEN';end if;
 insert into public.whatsapp_outbox(tenant_id,contract_id,party_id,days_before,renewal_date)
 select c.tenant_id,c.id,c.customer_id,d,c.end_date from public.customer_contracts c join public.parties p on p.id=c.customer_id and p.wa_opt_in and p.whatsapp is not null
 join public.tenants t on t.id=c.tenant_id join public.tenant_modules m on m.tenant_id=c.tenant_id and m.module_key='whatsapp' and m.enabled cross join unnest(array[60,30,7]) d
 where c.tenant_id=public.auth_tenant() and c.status='active' and c.end_date-(now() at time zone t.timezone)::date=d on conflict do nothing;
 get diagnostics n=row_count;return n;
end $$;
revoke all on function create_ledger_account(text,text,text),create_cash_account(text,text,text),queue_tenant_reminders() from public;
grant execute on function create_ledger_account(text,text,text),create_cash_account(text,text,text),queue_tenant_reminders() to authenticated;

create table contract_installments(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,
 customer_contract_id uuid,upstream_contract_id uuid,party_id uuid not null,ref_no text not null,
 due_date date not null,amount numeric(14,2) not null check(amount>0 and amount<>'NaN'),invoice_id uuid,
 check((customer_contract_id is null)<>(upstream_contract_id is null)),unique(tenant_id,id),unique(tenant_id,ref_no),
 foreign key(tenant_id,customer_contract_id) references customer_contracts(tenant_id,id),foreign key(tenant_id,upstream_contract_id) references upstream_contracts(tenant_id,id),
 foreign key(tenant_id,party_id) references parties(tenant_id,id),foreign key(tenant_id,invoice_id) references invoices(tenant_id,id));
alter table contract_installments enable row level security;
create policy installment_read on contract_installments for select to authenticated using(tenant_id=auth_tenant() and private.allowed('finance') and
 ((customer_contract_id is not null and private.contract_access(customer_contract_id)) or (upstream_contract_id is not null and (private.profile()).scope_district_id is null)));
revoke all on contract_installments from anon,authenticated;grant select on contract_installments to authenticated;
create trigger immutable_tenant before update on contract_installments for each row execute function private.immutable_tenant();
create trigger audit_change after insert or update on contract_installments for each row execute function private.audit_change();
create function schedule_installment(p_customer_contract uuid,p_upstream_contract uuid,p_party uuid,p_ref text,p_due date,p_amount numeric) returns uuid
language plpgsql security definer set search_path='' as $$ declare r uuid;begin
 if not private.allowed('finance') then raise exception 'FORBIDDEN';end if;
 if p_customer_contract is not null and not exists(select 1 from public.customer_contracts where id=p_customer_contract and tenant_id=public.auth_tenant() and customer_id=p_party and private.contract_access(id)) then raise exception 'INVALID_CUSTOMER';end if;
 if p_upstream_contract is not null and ((private.profile()).scope_district_id is not null or not exists(select 1 from public.upstream_contracts where id=p_upstream_contract and tenant_id=public.auth_tenant())) then raise exception 'FORBIDDEN';end if;
 insert into public.contract_installments(tenant_id,customer_contract_id,upstream_contract_id,party_id,ref_no,due_date,amount)
 values(public.auth_tenant(),p_customer_contract,p_upstream_contract,p_party,p_ref,p_due,p_amount) returning id into r;return r;
end $$;
create function issue_installment_invoice(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.contract_installments;r uuid;begin
 if not private.allowed('finance') then raise exception 'FORBIDDEN';end if;
 select * into i from public.contract_installments where id=p_id and tenant_id=public.auth_tenant() for update;
 if i.id is null or i.invoice_id is not null then raise exception 'INSTALLMENT_ALREADY_INVOICED';end if;
 if (i.customer_contract_id is not null and not private.contract_access(i.customer_contract_id)) or (i.upstream_contract_id is not null and (private.profile()).scope_district_id is not null) then raise exception 'FORBIDDEN';end if;
 insert into public.invoices(tenant_id,ref_no,party_id,contract_id,direction,amount,due_date)
 values(i.tenant_id,i.ref_no,i.party_id,i.customer_contract_id,case when i.customer_contract_id is null then 'payable' else 'receivable' end,i.amount,i.due_date) returning id into r;
 update public.contract_installments set invoice_id=r where id=i.id;return r;
end $$;
revoke all on function schedule_installment(uuid,uuid,uuid,text,date,numeric),issue_installment_invoice(uuid) from public;
grant execute on function schedule_installment(uuid,uuid,uuid,text,date,numeric),issue_installment_invoice(uuid) to authenticated;
create index on contract_installments(tenant_id,due_date);
create index on contract_installments(tenant_id,customer_contract_id,upstream_contract_id);

create function private.check_purchase_invoice() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.purchase_id is not null and not exists(select 1 from public.purchase_orders p where p.id=new.purchase_id and p.tenant_id=new.tenant_id
 and p.status='received' and p.supplier_id=new.party_id and new.direction='payable'
 and new.amount=(select round(sum(quantity*unit_cost),2) from public.purchase_lines where purchase_id=p.id)) then raise exception 'INVALID_PURCHASE_INVOICE';end if;
 return new;
end $$;
revoke all on function private.check_purchase_invoice() from public;
create trigger a_check_purchase_invoice before insert on invoices for each row execute function private.check_purchase_invoice();
-- Complete financial audit trail, immutable to application roles.
create trigger audit_change after insert on cash_transactions for each row execute function private.audit_change();
create trigger audit_change after insert on journal_entries for each row execute function private.audit_change();


-- SOURCE: 20261017192252_invoice_lines_tax_and_asset_details.sql
-- 0011: itemized invoices, explicit tax rates, administrative depreciation and retirement checks.

alter table invoices add column net_total numeric(14,2),add column tax_total numeric(14,2) not null default 0,
 add column issue_date date not null default current_date,
 add check(net_total is null or (net_total>=0 and net_total<>'NaN')),
 add check(tax_total>=0 and tax_total<>'NaN'),add check(net_total is null or amount=net_total+tax_total);
create table invoice_lines(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,invoice_id uuid not null,
 description text not null,quantity numeric(14,3) not null check(quantity>0 and quantity<>'NaN'),
 unit_price numeric(14,4) not null check(unit_price>=0 and unit_price<>'NaN'),
 discount numeric(14,2) not null default 0 check(discount>=0 and discount<>'NaN'),
 tax_rate numeric(5,2) not null default 0 check(tax_rate between 0 and 100),
 net_amount numeric(14,2) generated always as(round(quantity*unit_price-discount,2)) stored,
 tax_amount numeric(14,2) generated always as(round(round(quantity*unit_price-discount,2)*tax_rate/100,2)) stored,
 check(discount<=quantity*unit_price),foreign key(tenant_id,invoice_id) references invoices(tenant_id,id));
alter table invoice_lines enable row level security;
create policy invoice_lines_read on invoice_lines for select to authenticated using(tenant_id=auth_tenant() and exists(select 1 from invoices i where i.id=invoice_id));
revoke all on invoice_lines from anon,authenticated;grant select on invoice_lines to authenticated;
create index on invoice_lines(tenant_id,invoice_id);
create trigger immutable_tenant before update on invoice_lines for each row execute function private.immutable_tenant();
create function private.tax_accounts() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.ledger_accounts(tenant_id,code,name,kind) values(new.id,'1500','ضريبة مشتريات قابلة للتسوية','asset'),(new.id,'2300','ضريبة مبيعات مستحقة','liability') on conflict do nothing;return new;end $$;
revoke all on function private.tax_accounts() from public;
create trigger initialize_tax_accounts after insert on tenants for each row execute function private.tax_accounts();
insert into ledger_accounts(tenant_id,code,name,kind) select t.id,x.code,x.name,x.kind from tenants t cross join(values('1500','ضريبة مشتريات قابلة للتسوية','asset'),('2300','ضريبة مبيعات مستحقة','liability'))x(code,name,kind) on conflict do nothing;

create or replace function private.invoice_posting() returns trigger language plpgsql security definer set search_path='' as $$
declare dr uuid;cr uuid;tax uuid;lines jsonb;begin
 new.net_total:=coalesce(new.net_total,new.amount-new.tax_total);
 if new.direction='receivable' then
  select id into dr from public.ledger_accounts where tenant_id=new.tenant_id and code='1100';
  select id into cr from public.ledger_accounts where tenant_id=new.tenant_id and kind='revenue' and (id=new.category_account_id or(new.category_account_id is null and code='4000'));
  select id into tax from public.ledger_accounts where tenant_id=new.tenant_id and code='2300';
  lines:=jsonb_build_array(jsonb_build_object('account',dr,'debit',new.amount),jsonb_build_object('account',cr,'credit',new.net_total));
  if new.tax_total>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account',tax,'credit',new.tax_total));end if;
 else
  select id into dr from public.ledger_accounts where tenant_id=new.tenant_id and(kind in('expense','asset') or(code='2200' and new.purchase_id is not null)) and(id=new.category_account_id or(new.category_account_id is null and code='5300'));
  select id into cr from public.ledger_accounts where tenant_id=new.tenant_id and code='2000';
  select id into tax from public.ledger_accounts where tenant_id=new.tenant_id and code='1500';
  lines:=jsonb_build_array(jsonb_build_object('account',dr,'debit',new.net_total),jsonb_build_object('account',cr,'credit',new.amount));
  if new.tax_total>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account',tax,'debit',new.tax_total));end if;
 end if;
 if dr is null or cr is null then raise exception 'INVALID_ACCOUNT';end if;
 new.journal_entry_id:=private.post_journal(new.tenant_id,'INV/'||new.id,new.issue_date,'فاتورة '||new.ref_no,'invoice',new.id,lines);return new;
end $$;

create function create_itemized_invoice(p_party uuid,p_direction text,p_ref text,p_issue date,p_due date,p_contract uuid,p_category uuid,p_lines jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();r uuid:=gen_random_uuid();l jsonb;net numeric:=0;tax numeric:=0;line_net numeric;qty numeric;price numeric;discount numeric;rate numeric;begin
 if not private.allowed('finance') then raise exception 'FORBIDDEN';end if;
 if p_contract is not null then
  if not private.contract_access(p_contract) or not exists(select 1 from public.customer_contracts where id=p_contract and tenant_id=t and customer_id=p_party) or p_direction<>'receivable' then raise exception 'INVALID_CONTRACT_INVOICE';end if;
 elsif (private.profile()).scope_district_id is not null then raise exception 'FORBIDDEN';end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 200 then raise exception 'INVALID_LINES';end if;
 for l in select value from jsonb_array_elements(p_lines) loop
  qty:=round((l->>'quantity')::numeric,3);price:=round((l->>'unit_price')::numeric,4);discount:=round(coalesce((l->>'discount')::numeric,0),2);rate:=round(coalesce((l->>'tax_rate')::numeric,0),2);
  if qty is null or price is null or qty<=0 or qty='NaN' or price<0 or price='NaN' or discount<0 or discount>qty*price or discount='NaN' or rate not between 0 and 100 or length(trim(l->>'description'))<1 then raise exception 'INVALID_INVOICE_LINE';end if;
  line_net:=round(qty*price-discount,2);net:=net+line_net;tax:=tax+round(line_net*rate/100,2);
 end loop;
 insert into public.invoices(id,tenant_id,ref_no,party_id,contract_id,direction,amount,due_date,issue_date,category_account_id,net_total,tax_total)
 values(r,t,p_ref,p_party,p_contract,p_direction,net+tax,p_due,p_issue,p_category,net,tax);
 for l in select value from jsonb_array_elements(p_lines) loop
  insert into public.invoice_lines(tenant_id,invoice_id,description,quantity,unit_price,discount,tax_rate)
  values(t,r,l->>'description',round((l->>'quantity')::numeric,3),round((l->>'unit_price')::numeric,4),round(coalesce((l->>'discount')::numeric,0),2),round(coalesce((l->>'tax_rate')::numeric,0),2));
 end loop;return r;
end $$;
revoke all on function create_itemized_invoice(uuid,text,text,date,date,uuid,uuid,jsonb) from public;
grant execute on function create_itemized_invoice(uuid,text,text,date,date,uuid,uuid,jsonb) to authenticated;

alter table assets add check(cost is null or(cost>=0 and cost<>'NaN')),add check(useful_life_months is null or useful_life_months>0);
create or replace view v_asset_directory with(security_invoker=true) as
select v.*,s.name street_name,s.district_id,d.name district_name,ty.name type_name,
 a.length_m,a.width_m,a.faces,a.material,a.public_visible,a.notes,st_y(a.geom) latitude,st_x(a.geom) longitude,
 a.cost,a.install_date,a.useful_life_months
from v_assets_live v join assets a on a.id=v.id join streets s on s.id=v.street_id
join districts d on d.id=s.district_id join asset_types ty on ty.id=v.type_id;
create view v_asset_depreciation with(security_invoker=true) as
select a.tenant_id,a.id,a.code,a.cost,a.install_date,a.useful_life_months,
 round(a.cost/nullif(a.useful_life_months,0),2) monthly_depreciation,
 round(a.cost*least(a.useful_life_months,greatest(0,extract(year from age(current_date,a.install_date))*12+extract(month from age(current_date,a.install_date))))/nullif(a.useful_life_months,0),2) accumulated_depreciation
from assets a where a.cost is not null and a.install_date is not null and a.useful_life_months>0;
grant select on v_asset_depreciation to authenticated;revoke all on v_asset_depreciation from anon;
create function private.protect_retirement() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.status='retired' and old.status<>'retired' and exists(select 1 from public.contract_lines where asset_id=new.id and status='active' and end_date>=current_date) then raise exception 'ASSET_HAS_ACTIVE_LEASES';end if;return new;end $$;
revoke all on function private.protect_retirement() from public;
create trigger protect_retirement before update on assets for each row execute function private.protect_retirement();


-- SOURCE: 20261017192705_accounting_adjustments_and_staff_directory.sql

-- Names are returned only to HR/admin; auth identities remain outside the browser.
create function tenant_user_directory() returns table(id uuid,full_name text,role text)
language sql stable security definer set search_path='' as $$
 select p.id,p.full_name,p.role::text from public.profiles p
 where p.tenant_id=public.auth_tenant() and private.has_role(array['admin','hr'])
 and ((private.profile()).scope_district_id is null or p.scope_district_id=(private.profile()).scope_district_id)
 order by p.full_name,p.id $$;
revoke all on function tenant_user_directory() from public;
grant execute on function tenant_user_directory() to authenticated;

create function create_adjustment_journal(p_ref text,p_date date,p_description text,p_lines jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();l jsonb;debits numeric:=0;credits numeric:=0;dr numeric;cr numeric;begin
 if not private.allowed('finance') or (private.profile()).scope_district_id is not null then raise exception 'FORBIDDEN';end if;
 if length(trim(p_ref))<1 or length(trim(p_description))<5 or p_date is null or p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 2 and 100 then raise exception 'INVALID_JOURNAL';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,0));
 for l in select value from jsonb_array_elements(p_lines) loop
  if not exists(select 1 from public.ledger_accounts a where a.id=(l->>'account')::uuid and a.tenant_id=t and a.active
    and a.code not in ('1100','1400','2000','2100','2200')
    and not exists(select 1 from public.cash_accounts c where c.ledger_account_id=a.id)) then raise exception 'CONTROL_ACCOUNT_REQUIRES_WORKFLOW';end if;
  dr:=coalesce((l->>'debit')::numeric,0);cr:=coalesce((l->>'credit')::numeric,0);
  if dr<0 or cr<0 or dr='NaN' or cr='NaN' or round(dr,2)<>dr or round(cr,2)<>cr or ((dr>0)=(cr>0)) then raise exception 'INVALID_JOURNAL_LINE';end if;
  debits:=debits+dr;credits:=credits+cr;
 end loop;
 if debits<>credits or debits<=0 then raise exception 'UNBALANCED_JOURNAL';end if;
 return private.post_journal(t,'ADJ/'||p_ref,p_date,p_description,'adjustment',gen_random_uuid(),p_lines);
end $$;
revoke all on function create_adjustment_journal(text,date,text,jsonb) from public;
grant execute on function create_adjustment_journal(text,date,text,jsonb) to authenticated;
create function private.validate_installment() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.customer_contract_id is not null and not exists(select 1 from public.customer_contracts c where c.id=new.customer_contract_id and c.tenant_id=new.tenant_id and c.customer_id=new.party_id and c.status<>'cancelled') then raise exception 'INVALID_CONTRACT_INSTALLMENT';end if;
 if new.upstream_contract_id is not null and not exists(select 1 from public.upstream_contracts c where c.id=new.upstream_contract_id and c.tenant_id=new.tenant_id and new.party_id in (c.grantor_party_id,c.master_party_id) and c.status<>'cancelled') then raise exception 'INVALID_UPSTREAM_PARTY';end if;
 return new;
end $$;
revoke all on function private.validate_installment() from public;
create trigger validate_installment before insert or update on contract_installments for each row execute function private.validate_installment();


-- SOURCE: 20261017193350_hosted_permissions_and_indexes.sql

-- Supabase's hosted default privileges include explicit anon grants, independently of PUBLIC.
revoke all privileges on all tables in schema public from anon;
revoke truncate,references,trigger on all tables in schema public from authenticated;
revoke all on schema private from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from public,anon;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname,p.prorettype
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind='f' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') loop
  if f.proname not in('tenant_by_host','public_catalog','submit_enquiry') then
   execute format('revoke execute on function %s from public,anon',f.signature);
  end if;
  if f.prorettype='trigger'::regtype then execute format('revoke execute on function %s from authenticated',f.signature);end if;
 end loop;
 -- PostGIS statistics helpers are not part of the application API.
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='st_estimatedextent' loop
  execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
-- Extension metadata is read-only; no tenant data is stored here.
revoke all on public.spatial_ref_sys from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_class where oid='public.spatial_ref_sys'::regclass and pg_has_role(current_user,relowner,'USAGE')) then
  alter table public.spatial_ref_sys enable row level security;
  grant select on public.spatial_ref_sys to authenticated;
  create policy spatial_reference_read on public.spatial_ref_sys for select to authenticated using(true);
 end if;
end $$;
create policy domain_operator_only on public.tenant_domains for select to authenticated using(false);
alter policy profiles_read on profiles using(id=(select auth.uid()) or(tenant_id=auth_tenant() and auth_role()='admin'));
alter policy work_create on work_orders with check(tenant_id=auth_tenant() and private.asset_access(asset_id) and private.allowed('assets') and created_by=(select auth.uid()) and status in('open','assigned') and completed_at is null and(assigned_employee_id is null or private.employee_access(assigned_employee_id)));
-- Cover foreign-key lookups only when no existing index has the required leading columns.
do $$ declare c record;cols text;begin
 for c in select co.oid,co.conrelid,co.conkey,co.conname from pg_constraint co join pg_class t on t.oid=co.conrelid join pg_namespace n on n.oid=t.relnamespace
 where co.contype='f' and n.nspname='public' and not exists(
 select 1 from pg_index i where i.indrelid=co.conrelid and i.indisvalid and i.indpred is null
 and(select array_agg(k order by ord) from unnest(i.indkey::smallint[]) with ordinality u(k,ord) where ord<=cardinality(co.conkey))=co.conkey) loop
  select string_agg(quote_ident(a.attname),',' order by u.ord) into cols from unnest(c.conkey) with ordinality u(k,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.k;
  execute format('create index if not exists %I on %s(%s)','fk_'||md5(c.conname||c.conrelid::regclass::text),c.conrelid::regclass,cols);
 end loop;
end $$;
notify pgrst,'reload schema';


-- SOURCE: 20261017193658_upstream_parties_and_contract_billing.sql

create function create_upstream_agreement(p_ref text,p_start date,p_end date,p_model text,p_annual_fee numeric,p_assets jsonb,p_grantor uuid,p_master uuid) returns uuid
language plpgsql security definer set search_path='' as $$ declare t uuid:=public.auth_tenant();r uuid;begin
 if public.auth_role() is distinct from 'admin' then raise exception 'FORBIDDEN';end if;
 if p_grantor is null and p_master is null then raise exception 'UPSTREAM_PARTY_REQUIRED';end if;
 if p_grantor is not null and not exists(select 1 from public.parties where tenant_id=t and id=p_grantor and type='authority') then raise exception 'INVALID_GRANTOR';end if;
 if p_master is not null and not exists(select 1 from public.parties where tenant_id=t and id=p_master and type='master_concessionaire') then raise exception 'INVALID_MASTER_PARTY';end if;
 r:=public.create_upstream_contract(p_ref,p_start,p_end,p_model,p_annual_fee,p_assets);
 update public.upstream_contracts set grantor_party_id=p_grantor,master_party_id=p_master where id=r and tenant_id=t;
 return r;
end $$;
revoke all on function create_upstream_agreement(text,date,date,text,numeric,jsonb,uuid,uuid) from public,anon;
grant execute on function create_upstream_agreement(text,date,date,text,numeric,jsonb,uuid,uuid) to authenticated;

create function private.check_invoice_control_account() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.category_account_id is not null and exists(select 1 from public.ledger_accounts a where a.id=new.category_account_id and a.tenant_id=new.tenant_id
 and(a.code in('1100','1400','1500') or exists(select 1 from public.cash_accounts c where c.ledger_account_id=a.id))) then raise exception 'CONTROL_ACCOUNT_REQUIRES_WORKFLOW';end if;
 return new;
end $$;
revoke all on function private.check_invoice_control_account() from public,anon,authenticated;
create trigger a_check_invoice_control_account before insert on invoices for each row execute function private.check_invoice_control_account();

-- Check all later balances too: a backdated payment must not overdraw an already-spent balance.
create or replace function private.cash_can_spend(c uuid,t uuid,amount numeric,day date) returns boolean
language sql stable security definer set search_path='' as $$
 with account as(select ledger_account_id,allow_overdraft from public.cash_accounts where id=c and tenant_id=t),
 daily as(select e.entry_date,sum(l.debit-l.credit) movement from public.journal_lines l join public.journal_entries e on e.id=l.entry_id join account a on a.ledger_account_id=l.account_id group by e.entry_date),
 balances as(select entry_date,sum(movement) over(order by entry_date) balance from daily),
 limits as(select(select sum(movement) from daily where entry_date<=day) initial,(select min(balance) from balances where entry_date>=day) later)
 select exists(select 1 from account cross join limits where day is not null and amount>0 and(allow_overdraft or least(coalesce(initial,0),coalesce(later,initial,0))>=amount)) $$;
revoke all on function private.cash_can_spend(uuid,uuid,numeric,date) from public,anon,authenticated;
notify pgrst,'reload schema';


-- SOURCE: 20261018090705_asset_register_and_lifecycle.sql
-- Keep retired assets in an RLS-protected register without changing operating KPIs.

create view public.v_asset_register with(security_invoker=true) as
select a.id,a.tenant_id,a.code,a.street_id,a.type_id,a.status,a.geom,
 d.line_id,d.lease_end,d.monthly_price,d.monthly_cost,d.coverage_end,
 coalesce(d.live_status,'retired') live_status,coalesce(d.chain_conflict,false) chain_conflict,
 s.name street_name,s.district_id,di.name district_name,ty.name type_name,
 a.length_m,a.width_m,a.faces,a.material,a.public_visible,a.notes,
 st_y(a.geom) latitude,st_x(a.geom) longitude,a.cost,a.install_date,a.useful_life_months
from public.assets a
join public.streets s on s.id=a.street_id
join public.districts di on di.id=s.district_id
join public.asset_types ty on ty.id=a.type_id
left join public.v_asset_directory d on d.id=a.id;
revoke all on public.v_asset_register from public,anon,authenticated;
grant select on public.v_asset_register to authenticated;

-- Lock the same asset row used by retirement updates, including concurrent bookings.
create function private.protect_asset_booking() returns trigger
language plpgsql security definer set search_path='' as $$
declare asset_status text;
begin
 if new.status='active' then
  select status into asset_status from public.assets
   where id=new.asset_id and tenant_id=new.tenant_id for update;
  if asset_status='retired' then raise exception 'ASSET_RETIRED';end if;
 end if;
 return new;
end $$;
revoke all on function private.protect_asset_booking() from public,anon,authenticated;
create trigger asset_booking_lifecycle before insert or update on public.contract_lines
for each row execute function private.protect_asset_booking();
notify pgrst,'reload schema';


-- SOURCE: 20261018105231_agency_website_content.sql

create table public.tenant_website(
 tenant_id uuid primary key references public.tenants,
 content jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.tenant_website enable row level security;
revoke all on public.tenant_website from public,anon,authenticated;
grant select,insert,update on public.tenant_website to authenticated;
create policy website_admin_read on public.tenant_website for select to authenticated
 using(tenant_id=(select public.auth_tenant()) and (select public.auth_role())='admin');
create policy website_admin_insert on public.tenant_website for insert to authenticated
 with check(tenant_id=(select public.auth_tenant()) and (select public.auth_role())='admin');
create policy website_admin_update on public.tenant_website for update to authenticated
 using(tenant_id=(select public.auth_tenant()) and (select public.auth_role())='admin')
 with check(tenant_id=(select public.auth_tenant()) and (select public.auth_role())='admin');
create trigger immutable_tenant before update on public.tenant_website for each row execute function private.immutable_tenant();

create function private.validate_website() returns trigger language plpgsql set search_path='' as $$
declare section text; entry jsonb; field text; link text; limit_rows int;
begin
 if jsonb_typeof(new.content)<>'object' or octet_length(new.content::text)>80000 then raise exception 'INVALID_WEBSITE_CONTENT';end if;
 if length(coalesce(new.content->>'about_title',''))>200 or length(coalesce(new.content->>'about_text',''))>2500 then raise exception 'INVALID_WEBSITE_CONTENT';end if;
 foreach field in array array['about_title','about_text'] loop
  if new.content ? field and jsonb_typeof(new.content->field)<>'string' then raise exception 'INVALID_WEBSITE_CONTENT';end if;
 end loop;
 foreach section in array array['slides','partners','places','projects'] loop
  if new.content ? section then
   limit_rows:=case section when 'slides' then 8 when 'partners' then 24 else 12 end;
   if jsonb_typeof(new.content->section)<>'array' or jsonb_array_length(new.content->section)>limit_rows then raise exception 'INVALID_WEBSITE_CONTENT';end if;
   for entry in select value from jsonb_array_elements(new.content->section) loop
    if jsonb_typeof(entry)<>'object' or length(trim(coalesce(entry->>'title',entry->>'name','')))=0 then raise exception 'INVALID_WEBSITE_CONTENT';end if;
    if length(coalesce(entry->>'title',entry->>'name',''))>200 or length(coalesce(entry->>'description',''))>1500 then raise exception 'INVALID_WEBSITE_CONTENT';end if;
    foreach field in array array['title','name','accent','eyebrow','alt','description','category','image_url','logo_url','website','map_url'] loop
     if entry ? field and jsonb_typeof(entry->field)<>'string' then raise exception 'INVALID_WEBSITE_CONTENT';end if;
    end loop;
    if section='slides' and length(trim(coalesce(entry->>'image_url','')))=0 then raise exception 'INVALID_WEBSITE_CONTENT';end if;
    foreach field in array array['image_url','logo_url','website','map_url'] loop
     link:=coalesce(entry->>field,'');
     if link<>'' and (length(link)>2000 or link !~ '^https://[^[:space:]]+$' and not(field='image_url' and link ~ '^/media/[a-zA-Z0-9/_.-]+$')) then raise exception 'INVALID_WEBSITE_URL';end if;
    end loop;
   end loop;
  end if;
 end loop;
 new.updated_at:=now();return new;
end $$;
revoke all on function private.validate_website() from public,anon,authenticated;
create trigger validate_website before insert or update on public.tenant_website for each row execute function private.validate_website();
create trigger audit_website after insert or update on public.tenant_website for each row execute function private.audit_change();

-- This deliberately exposes only publishable website content for verified, enabled hosts.
create function public.public_website(p_host text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('content',coalesce(w.content,'{}'::jsonb),'areas',coalesce((select jsonb_agg(d.name order by d.name) from public.districts d where d.tenant_id=t.id),'[]'::jsonb))
 from public.tenants t join public.tenant_domains h on h.tenant_id=t.id
 left join public.tenant_website w on w.tenant_id=t.id
 where h.domain=lower(p_host) and h.verified and t.public_site_enabled
 limit 1
$$;
revoke all on function public.public_website(text) from public,anon,authenticated;
grant execute on function public.public_website(text) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('tenant-website','tenant-website',true,2097152,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy website_media_insert on storage.objects for insert to authenticated
 with check(bucket_id='tenant-website' and (storage.foldername(name))[1]=public.auth_tenant()::text and public.auth_role()='admin');
create policy website_media_read on storage.objects for select to authenticated
 using(bucket_id='tenant-website' and (storage.foldername(name))[1]=public.auth_tenant()::text and public.auth_role()='admin');
notify pgrst,'reload schema';


-- SOURCE: 20261018164000_asset_photos_and_location.sql

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('asset-photos','asset-photos',false,2097152,array['image/png','image/jpeg','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function private.asset_photo_access(object_name text, writing boolean default false)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare parts text[]:=string_to_array(object_name,'/'); a uuid; t uuid:=public.auth_tenant();
begin
 if t is null or array_length(parts,1)<>3 or parts[1]<>t::text or coalesce(parts[3],'')='' then return false;end if;
 begin a:=parts[2]::uuid; exception when invalid_text_representation then return false;end;
 return private.asset_access(a) and (not writing or private.allowed('assets'))
   and exists(select 1 from public.tenant_modules where tenant_id=t and module_key='assets' and enabled);
end $$;
revoke all on function private.asset_photo_access(text,boolean) from public,anon;
grant execute on function private.asset_photo_access(text,boolean) to authenticated;
create policy asset_photo_read on storage.objects for select to authenticated
 using(bucket_id='asset-photos' and private.asset_photo_access(name));
create policy asset_photo_insert on storage.objects for insert to authenticated
 with check(bucket_id='asset-photos' and private.asset_photo_access(name,true));
create policy asset_photo_delete on storage.objects for delete to authenticated
 using(bucket_id='asset-photos' and private.asset_photo_access(name,true));
-- No UPDATE policy: existing originals cannot be overwritten or moved.
create function set_asset_location(p_id uuid,p_latitude double precision,p_longitude double precision,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant(); previous public.geometry;
begin
 if not private.allowed('assets') or not private.asset_access(p_id)
 or not exists(select 1 from public.tenant_modules where tenant_id=t and module_key='assets' and enabled) then raise exception 'FORBIDDEN';end if;
 if p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90) or not(p_longitude between -180 and 180) then raise exception 'INVALID_COORDINATES';end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception 'REASON_REQUIRED';end if;
 select geom into previous from public.assets where tenant_id=t and id=p_id for update;
 if not found then raise exception 'FORBIDDEN';end if;
 update public.assets set geom=public.st_setsrid(public.st_makepoint(p_longitude,p_latitude),4326) where tenant_id=t and id=p_id;
 insert into public.audit_events(tenant_id,actor_id,table_name,record_id,operation,changes)
 values(t,auth.uid(),'assets',p_id,'ASSET_LOCATION',jsonb_build_object('reason',trim(p_reason),
 'before',jsonb_build_object('latitude',public.st_y(previous),'longitude',public.st_x(previous)),
 'after',jsonb_build_object('latitude',p_latitude,'longitude',p_longitude)));
end $$;
revoke all on function set_asset_location(uuid,double precision,double precision,text) from public,anon;
grant execute on function set_asset_location(uuid,double precision,double precision,text) to authenticated;
notify pgrst,'reload schema';

commit;
