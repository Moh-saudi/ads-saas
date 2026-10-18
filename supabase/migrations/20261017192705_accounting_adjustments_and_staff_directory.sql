begin;
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
commit;
