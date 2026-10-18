-- 0007: complete operational records. All business mutations use controlled RPCs.
begin;
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
commit;
