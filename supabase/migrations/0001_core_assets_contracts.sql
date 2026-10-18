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
