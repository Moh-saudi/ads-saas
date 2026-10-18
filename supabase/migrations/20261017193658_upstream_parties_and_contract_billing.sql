begin;
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
commit;
