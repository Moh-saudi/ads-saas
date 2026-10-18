-- 0006: immutable privileged lookups and header/coverage consistency.
begin;
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
commit;
