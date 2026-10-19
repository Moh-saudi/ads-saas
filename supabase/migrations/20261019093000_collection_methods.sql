begin;
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
commit;
