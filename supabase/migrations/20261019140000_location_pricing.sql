begin;
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
commit;
