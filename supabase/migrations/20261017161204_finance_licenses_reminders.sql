-- 0004: invoices, receipts, national-company dues, licenses, and opt-in reminder outbox.
begin;
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
commit;
