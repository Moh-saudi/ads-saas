-- 0010: account configuration, installments, operational safeguards, tenant reminder queue.
begin;
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
commit;
