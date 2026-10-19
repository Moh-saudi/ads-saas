-- Existing installations through asset photos/location migration. Run ONCE in Supabase SQL Editor.
-- Atomic upgrade: no demo writes, historical contracts are retained.
begin;
do $install_collection$
begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='payment_method') then
  execute $collection_sql$

alter table public.payments add column payment_method text not null default 'unknown'
 check(payment_method in ('unknown','cash','bank_transfer','instapay','vodafone_cash','card','other'));
alter table public.cash_transactions add column payment_method text not null default 'unknown'
 check(payment_method in ('unknown','cash','bank_transfer','instapay','vodafone_cash','card','other'));
-- Historical transactions remain unknown; a bank account does not identify the payment channel.
create function public.record_invoice_payment_with_method(p_invoice_id uuid,p_amount numeric,p_paid_on date,p_reference text,p_cash_account_id uuid,p_payment_method text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid; e uuid; t uuid:=public.auth_tenant();
begin
 if p_payment_method is null or p_payment_method not in ('cash','bank_transfer','instapay','vodafone_cash','card','other') then raise exception 'PAYMENT_METHOD_REQUIRED';end if;
 -- The original workflow retains all tenant, scope, balance, amount and ledger checks.
 r:=public.record_invoice_payment(p_invoice_id,p_amount,p_paid_on,p_reference,p_cash_account_id);
 update public.payments set payment_method=p_payment_method where id=r and tenant_id=t returning journal_entry_id into e;
 update public.cash_transactions set payment_method=p_payment_method where journal_entry_id=e and tenant_id=t;
 return r;
end $$;
revoke all on function public.record_invoice_payment_with_method(uuid,numeric,date,text,uuid,text) from public,anon;
grant execute on function public.record_invoice_payment_with_method(uuid,numeric,date,text,uuid,text) to authenticated;
create function public.create_cash_transaction_with_method(p_kind text,p_ref text,p_cash uuid,p_target uuid,p_category uuid,p_amount numeric,p_date date,p_description text,p_asset uuid,p_work uuid,p_payment_method text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid;
begin
 if p_payment_method is null or p_payment_method not in ('cash','bank_transfer','instapay','vodafone_cash','card','other') then raise exception 'PAYMENT_METHOD_REQUIRED';end if;
 r:=public.create_cash_transaction(p_kind,p_ref,p_cash,p_target,p_category,p_amount,p_date,p_description,p_asset,p_work);
 update public.cash_transactions set payment_method=p_payment_method where id=r and tenant_id=public.auth_tenant();
 return r;
end $$;
revoke all on function public.create_cash_transaction_with_method(text,text,uuid,uuid,uuid,numeric,date,text,uuid,uuid,text) from public,anon;
grant execute on function public.create_cash_transaction_with_method(text,text,uuid,uuid,uuid,numeric,date,text,uuid,uuid,text) to authenticated;
create index cash_collection_method_idx on public.cash_transactions(tenant_id,transaction_date,payment_method) where kind in ('receipt','income');
notify pgrst,'reload schema';

$collection_sql$;
 elsif to_regprocedure('public.record_invoice_payment_with_method(uuid,numeric,date,text,uuid,text)') is null then
  raise exception 'INCOMPLETE_COLLECTION_UPGRADE: finish the collection methods migration first';
 end if;
end $install_collection$;
-- SOURCE: 20261019130000_license_contract_periods.sql
-- License validity is mandatory for new/changed active reservations, including admin exceptions.

alter table public.licenses add column valid_from date,
  add column status text not null default 'active' check(status in ('active','revoked')),
  add constraint license_valid_period check(valid_from is null or valid_from<=expires_on);
-- One authority permit may cover several billboard locations.
alter table public.licenses drop constraint licenses_tenant_id_ref_no_key;
alter table public.licenses add unique(tenant_id,ref_no,asset_id);
create index licenses_asset_period on public.licenses(tenant_id,asset_id,expires_on) where status='active';

create function private.guard_license_booking() returns trigger
language plpgsql security definer set search_path='' as $$
declare covered boolean;
begin
 if new.status<>'active' then return new; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.tenant_id::text,0));
 select coalesce(range_agg(daterange(l.valid_from,l.expires_on,'[]')) @> daterange(new.start_date,new.end_date,'[]'),false)
 into covered from public.licenses l where l.tenant_id=new.tenant_id and l.asset_id=new.asset_id and l.status='active';
 if not covered then raise exception 'LICENSE_PERIOD_CONFLICT'; end if;
 return new;
end $$;
revoke all on function private.guard_license_booking() from public,anon,authenticated;
create trigger zz_license_booking before insert or update on public.contract_lines for each row execute function private.guard_license_booking();

create function private.protect_license_reservations() returns trigger
language plpgsql security definer set search_path='' as $$
declare invalid boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.tenant_id::text,0));
 if tg_op='UPDATE' and new.asset_id=old.asset_id and new.tenant_id=old.tenant_id and new.status=old.status
   and new.valid_from is not distinct from old.valid_from and new.expires_on=old.expires_on then return new; end if;
 select exists(select 1 from public.contract_lines c where c.tenant_id=old.tenant_id and c.asset_id=old.asset_id
  and c.status='active' and c.end_date>=(now() at time zone 'Africa/Cairo')::date
  and not coalesce((select range_agg(daterange(v.valid_from,v.expires_on,'[]')) @> daterange(c.start_date,c.end_date,'[]') from (
   select l.valid_from,l.expires_on from public.licenses l where l.tenant_id=old.tenant_id and l.asset_id=old.asset_id and l.id<>old.id and l.status='active'
   union all select new.valid_from,new.expires_on where tg_op='UPDATE' and new.tenant_id=old.tenant_id and new.asset_id=old.asset_id and new.status='active'
  ) v),false)) into invalid;
 if invalid then raise exception 'LICENSE_HAS_ACTIVE_BOOKINGS'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function private.protect_license_reservations() from public,anon,authenticated;
create trigger protect_license before update or delete on public.licenses for each row execute function private.protect_license_reservations();

create function public.register_asset_licenses(p_assets uuid[],p_ref text,p_issuer text,p_start date,p_end date)
returns integer language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant(); a uuid; n integer:=0;
begin
 if t is null or not private.allowed('assets') then raise exception 'FORBIDDEN'; end if;
 if p_start is null or p_end is null or p_end<p_start or p_start='-infinity'::date or p_end='infinity'::date then raise exception 'INVALID_LICENSE_PERIOD'; end if;
 if nullif(trim(p_ref),'') is null or nullif(trim(p_issuer),'') is null or cardinality(p_assets) is null or cardinality(p_assets)<1 or cardinality(p_assets)>200 then raise exception 'INVALID_LICENSE'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t::text,0));
 for a in select distinct unnest(p_assets) loop
  if not private.asset_access(a) then raise exception 'ASSET_OUT_OF_SCOPE'; end if;
  insert into public.licenses(tenant_id,asset_id,ref_no,issuer,valid_from,expires_on) values(t,a,trim(p_ref),trim(p_issuer),p_start,p_end);
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.register_asset_licenses(uuid[],text,text,date,date) from public,anon;
grant execute on function public.register_asset_licenses(uuid[],text,text,date,date) to authenticated;


-- SOURCE: 20261019133000_link_asset_preparation.sql

alter table public.inventory_items add column length_m numeric check(length_m>0 and length_m<>'NaN'::numeric),
 add column width_m numeric check(width_m>0 and width_m<>'NaN'::numeric),add column material text;
alter table public.work_orders add column kind text not null default 'maintenance' check(kind in ('installation','removal','maintenance')),
 add column planned_start date,add constraint work_planned_period check(planned_start is null or planned_start<=due_date);
alter table public.purchase_orders add column asset_id uuid,add column work_order_id uuid,
 add column procurement_kind text not null default 'purchase' check(procurement_kind in ('purchase','external_manufacture')),
 add foreign key(tenant_id,asset_id) references public.assets(tenant_id,id),
 add foreign key(tenant_id,work_order_id) references public.work_orders(tenant_id,id);
create policy purchase_asset_scope on public.purchase_orders as restrictive for select to authenticated using(asset_id is null or private.asset_access(asset_id));
create function public.create_asset_purchase(p_ref text,p_supplier uuid,p_warehouse uuid,p_date date,p_expected date,p_lines jsonb,p_notes text,p_asset uuid,p_work uuid,p_kind text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid;t uuid:=public.auth_tenant();w public.work_orders;
begin
 if p_kind not in ('purchase','external_manufacture') or p_kind is null then raise exception 'INVALID_PROCUREMENT_KIND';end if;
 if p_asset is not null and not private.asset_access(p_asset) then raise exception 'ASSET_OUT_OF_SCOPE'; end if;
 if p_work is not null then
  select * into w from public.work_orders where id=p_work and tenant_id=t;
  if w.id is null or not private.asset_access(w.asset_id) or w.asset_id is distinct from p_asset or w.status in ('completed','cancelled') then raise exception 'INVALID_PROCUREMENT_WORK'; end if;
 end if;
 r:=public.create_purchase(p_ref,p_supplier,p_warehouse,p_date,p_expected,p_lines,p_notes);
 update public.purchase_orders set asset_id=p_asset,work_order_id=p_work,procurement_kind=p_kind where id=r and tenant_id=t;
 return r;
end $$;
revoke all on function public.create_asset_purchase(text,uuid,uuid,date,date,jsonb,text,uuid,uuid,text) from public,anon;
grant execute on function public.create_asset_purchase(text,uuid,uuid,date,date,jsonb,text,uuid,uuid,text) to authenticated;
create function public.progress_asset_work(p_id uuid,p_status text,p_resolution text)
returns void language plpgsql security definer set search_path='' as $$
declare w public.work_orders;
begin
 perform public.progress_work_order(p_id,p_status,p_resolution);
 select * into w from public.work_orders where id=p_id and tenant_id=public.auth_tenant();
 if p_status='completed' and w.kind='installation' then
  update public.assets set install_date=coalesce(install_date,(now() at time zone 'Africa/Cairo')::date) where id=w.asset_id and tenant_id=w.tenant_id;
 end if;
end $$;
revoke all on function public.progress_asset_work(uuid,text,text) from public,anon;
grant execute on function public.progress_asset_work(uuid,text,text) to authenticated;


-- SOURCE: 20261019140000_location_pricing.sql

create table public.pricing_rules(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants,
 district_id uuid not null,type_id uuid not null,monthly_price numeric(14,2) not null check(monthly_price>=0 and monthly_price<>'NaN'::numeric),
 valid_from date not null,valid_to date not null check(valid_to>=valid_from),
 foreign key(tenant_id,district_id) references public.districts(tenant_id,id),
 foreign key(tenant_id,type_id) references public.asset_types(tenant_id,id),
 period daterange generated always as(daterange(valid_from,valid_to,'[]')) stored,
 exclude using gist(tenant_id with =,district_id with =,type_id with =,period with &&)
);
alter table public.pricing_rules enable row level security;
create policy pricing_read on public.pricing_rules for select to authenticated using(tenant_id=public.auth_tenant() and private.in_district(district_id) and (private.allowed('sales') or private.allowed('finance')));
create policy pricing_insert on public.pricing_rules for insert to authenticated with check(tenant_id=public.auth_tenant() and private.in_district(district_id) and private.has_role(array['admin','area_manager']));
revoke all on public.pricing_rules from public,anon,authenticated;
grant select,insert on public.pricing_rules to authenticated;
grant all on public.pricing_rules to service_role;
create trigger immutable_tenant before update on public.pricing_rules for each row execute function private.immutable_tenant();
create trigger audit_change after insert or update or delete on public.pricing_rules for each row execute function private.audit_change();


-- SOURCE: 20261019143000_receipt_references.sql

-- Historical records remain readable; new electronic receipts must identify the transfer.
alter table public.payments add constraint electronic_payment_reference
 check(payment_method not in ('bank_transfer','instapay','vodafone_cash','card') or nullif(trim(reference),'') is not null) not valid;

commit;
