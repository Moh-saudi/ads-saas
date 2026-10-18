-- 0008: double-entry ledger, cash/bank books, automatic invoice/payment posting, payroll settlement.
begin;
create table ledger_accounts(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,code text not null,name text not null,
 kind text not null check(kind in ('asset','liability','equity','revenue','expense')),active boolean not null default true,
 unique(tenant_id,id),unique(tenant_id,code));
create table cash_accounts(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,name text not null,
 kind text not null check(kind in ('cash','bank')),ledger_account_id uuid not null,allow_overdraft boolean not null default false,
 unique(tenant_id,id),unique(tenant_id,ledger_account_id),foreign key(tenant_id,ledger_account_id) references ledger_accounts(tenant_id,id));
create table journal_entries(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,ref_no text not null,
 entry_date date not null,description text not null,source_kind text not null,source_id uuid not null,
 created_by uuid references auth.users,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,ref_no),unique(tenant_id,source_kind,source_id));
create table journal_lines(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,entry_id uuid not null,account_id uuid not null,
 debit numeric(14,2) not null default 0,credit numeric(14,2) not null default 0,
 check(debit>=0 and credit>=0 and debit<>'NaN' and credit<>'NaN' and ((debit>0 and credit=0) or (credit>0 and debit=0))),
 foreign key(tenant_id,entry_id) references journal_entries(tenant_id,id),foreign key(tenant_id,account_id) references ledger_accounts(tenant_id,id));
create table cash_transactions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,ref_no text not null,
 cash_account_id uuid not null,target_cash_account_id uuid,category_account_id uuid,
 kind text not null check(kind in ('income','expense','transfer','opening','receipt','payment','salary')),
 amount numeric(14,2) not null check(amount>0 and amount<>'NaN'),transaction_date date not null,description text not null,
 asset_id uuid,work_order_id uuid,journal_entry_id uuid not null,created_by uuid not null references auth.users,
 created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,ref_no),
 check((kind='transfer' and target_cash_account_id is not null and target_cash_account_id<>cash_account_id) or (kind<>'transfer' and target_cash_account_id is null)),
 foreign key(tenant_id,cash_account_id) references cash_accounts(tenant_id,id),foreign key(tenant_id,target_cash_account_id) references cash_accounts(tenant_id,id),
 foreign key(tenant_id,category_account_id) references ledger_accounts(tenant_id,id),foreign key(tenant_id,journal_entry_id) references journal_entries(tenant_id,id),
 foreign key(tenant_id,asset_id) references assets(tenant_id,id),foreign key(tenant_id,work_order_id) references work_orders(tenant_id,id));
alter table invoices add column journal_entry_id uuid,add column category_account_id uuid,
 add foreign key(tenant_id,journal_entry_id) references journal_entries(tenant_id,id),add foreign key(tenant_id,category_account_id) references ledger_accounts(tenant_id,id);
alter table payments add column cash_account_id uuid,add column journal_entry_id uuid,
 add foreign key(tenant_id,cash_account_id) references cash_accounts(tenant_id,id),add foreign key(tenant_id,journal_entry_id) references journal_entries(tenant_id,id);
alter table payroll_items add column approval_journal_id uuid,add column payment_journal_id uuid,
 add foreign key(tenant_id,approval_journal_id) references journal_entries(tenant_id,id),add foreign key(tenant_id,payment_journal_id) references journal_entries(tenant_id,id);

create function private.initialize_finance() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.ledger_accounts(tenant_id,code,name,kind)
 select new.id,code,name,kind from (values
 ('1000','الخزينة النقدية','asset'),('1010','الحساب البنكي','asset'),('1100','ذمم المعلنين','asset'),('1400','مخزون المعدات','asset'),
 ('2000','ذمم الوطنية والموردين','liability'),('2100','رواتب مستحقة','liability'),('2200','بضاعة مستلمة لم تفوتر','liability'),('3000','الأرصدة الافتتاحية وحقوق الملكية','equity'),
 ('4000','إيراد الإعلانات','revenue'),('4100','إيرادات أخرى','revenue'),('5000','مصروفات تشغيلية','expense'),
 ('5100','مصروف الرواتب','expense'),('5200','مصروف الصيانة','expense'),('5300','تكلفة الاستغلال والإيجار','expense'),('4200','زيادة جرد المخزون','revenue'),('5400','عجز جرد المخزون','expense')) x(code,name,kind)
 on conflict(tenant_id,code) do nothing;
 insert into public.cash_accounts(tenant_id,name,kind,ledger_account_id)
 select new.id,name,case code when '1000' then 'cash' else 'bank' end,id from public.ledger_accounts where tenant_id=new.id and code in ('1000','1010')
 on conflict(tenant_id,ledger_account_id) do nothing;
 return new;
end $$;
revoke all on function private.initialize_finance() from public;
create trigger initialize_finance after insert on tenants for each row execute function private.initialize_finance();
-- Seed account definitions for pre-existing tenants without assuming opening balances or payment methods.
insert into ledger_accounts(tenant_id,code,name,kind)
select t.id,x.code,x.name,x.kind from tenants t cross join (values
 ('1000','الخزينة النقدية','asset'),('1010','الحساب البنكي','asset'),('1100','ذمم المعلنين','asset'),('1400','مخزون المعدات','asset'),
 ('2000','ذمم الوطنية والموردين','liability'),('2100','رواتب مستحقة','liability'),('2200','بضاعة مستلمة لم تفوتر','liability'),('3000','الأرصدة الافتتاحية وحقوق الملكية','equity'),
 ('4000','إيراد الإعلانات','revenue'),('4100','إيرادات أخرى','revenue'),('5000','مصروفات تشغيلية','expense'),
 ('5100','مصروف الرواتب','expense'),('5200','مصروف الصيانة','expense'),('5300','تكلفة الاستغلال والإيجار','expense'),('4200','زيادة جرد المخزون','revenue'),('5400','عجز جرد المخزون','expense')) x(code,name,kind)
on conflict(tenant_id,code) do nothing;
insert into cash_accounts(tenant_id,name,kind,ledger_account_id)
select tenant_id,name,case code when '1000' then 'cash' else 'bank' end,id from ledger_accounts where code in ('1000','1010')
on conflict(tenant_id,ledger_account_id) do nothing;

do $$ declare t text; begin
 foreach t in array array['ledger_accounts','cash_accounts','journal_entries','journal_lines','cash_transactions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create index on public.%I(tenant_id)',t);
  execute format('create trigger immutable_tenant before update on public.%I for each row execute function private.immutable_tenant()',t);
  execute format('create policy finance_read on public.%I for select to authenticated using(tenant_id=public.auth_tenant() and private.allowed(''finance'') and (private.profile()).scope_district_id is null)',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create index on journal_lines(tenant_id,entry_id);
create index on journal_lines(tenant_id,account_id);
create index on journal_entries(tenant_id,entry_date);
create index on cash_transactions(tenant_id,cash_account_id,transaction_date);
create index on cash_transactions(tenant_id,work_order_id);

create function private.balance_journal() returns trigger language plpgsql security definer set search_path='' as $$
declare e uuid; begin
 if tg_table_name='journal_entries' then e:=new.id;else e:=new.entry_id;end if;
 if (select count(*)<2 or coalesce(sum(debit-credit),0)<>0 from public.journal_lines where entry_id=e) then raise exception 'UNBALANCED_JOURNAL';end if;
 return new;
end $$;
revoke all on function private.balance_journal() from public;
create constraint trigger balanced_entry after insert on journal_entries deferrable initially deferred for each row execute function private.balance_journal();
create constraint trigger balanced_lines after insert or update on journal_lines deferrable initially deferred for each row execute function private.balance_journal();

create function private.post_journal(t uuid,ref text,day date,descr text,source text,sourceid uuid,lines jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare e uuid:=gen_random_uuid(); l jsonb; begin
 if day is null or jsonb_array_length(lines)<2 then raise exception 'INVALID_JOURNAL';end if;
 insert into public.journal_entries(id,tenant_id,ref_no,entry_date,description,source_kind,source_id,created_by)
 values(e,t,ref,day,descr,source,sourceid,auth.uid());
 for l in select value from jsonb_array_elements(lines) loop
  if not exists(select 1 from public.ledger_accounts a where a.id=(l->>'account')::uuid and a.tenant_id=t and a.active) then raise exception 'INVALID_ACCOUNT';end if;
  insert into public.journal_lines(tenant_id,entry_id,account_id,debit,credit)
  values(t,e,(l->>'account')::uuid,coalesce((l->>'debit')::numeric,0),coalesce((l->>'credit')::numeric,0));
 end loop;return e;
end $$;
revoke all on function private.post_journal(uuid,text,date,text,text,uuid,jsonb) from public,anon,authenticated;

create view v_cash_balances with(security_invoker=true) as
select a.tenant_id,a.id,a.name,a.kind,a.ledger_account_id,a.allow_overdraft,coalesce(sum(l.debit-l.credit),0) balance
from cash_accounts a left join journal_lines l on l.account_id=a.ledger_account_id
group by a.tenant_id,a.id,a.name,a.kind,a.ledger_account_id,a.allow_overdraft;
create view v_trial_balance with(security_invoker=true) as
select a.tenant_id,a.id,a.code,a.name,a.kind,coalesce(sum(l.debit),0) debit,coalesce(sum(l.credit),0) credit,coalesce(sum(l.debit-l.credit),0) balance
from ledger_accounts a left join journal_lines l on l.account_id=a.id group by a.tenant_id,a.id,a.code,a.name,a.kind;
create view v_monthly_cashflow with(security_invoker=true) as
select tenant_id,date_trunc('month',transaction_date)::date as "month",
 coalesce(sum(amount) filter(where kind in ('income','receipt')),0) income,
 coalesce(sum(amount) filter(where kind in ('expense','payment','salary')),0) expense
from cash_transactions where kind not in ('opening','transfer') group by tenant_id,date_trunc('month',transaction_date);
grant select on v_cash_balances,v_trial_balance,v_monthly_cashflow to authenticated;
revoke all on v_cash_balances,v_trial_balance,v_monthly_cashflow from anon;

create function private.cash_can_spend(c uuid,t uuid,amount numeric,day date) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.cash_accounts a where a.id=c and a.tenant_id=t and
 (a.allow_overdraft or coalesce((select sum(l.debit-l.credit) from public.journal_lines l join public.journal_entries e on e.id=l.entry_id
 where l.account_id=a.ledger_account_id and e.entry_date<=day),0)>=amount)) $$;
revoke all on function private.cash_can_spend(uuid,uuid,numeric,date) from public,anon,authenticated;

create function private.invoice_posting() returns trigger language plpgsql security definer set search_path='' as $$
declare debit_account uuid;credit_account uuid;begin
 if new.direction='receivable' then
  select id into debit_account from public.ledger_accounts where tenant_id=new.tenant_id and code='1100';
  select id into credit_account from public.ledger_accounts where tenant_id=new.tenant_id and kind='revenue' and (id=new.category_account_id or (new.category_account_id is null and code='4000'));
 else
  select id into debit_account from public.ledger_accounts where tenant_id=new.tenant_id and kind in ('expense','asset') and (id=new.category_account_id or (new.category_account_id is null and code='5300'));
  select id into credit_account from public.ledger_accounts where tenant_id=new.tenant_id and code='2000';
 end if;
 if debit_account is null or credit_account is null then raise exception 'INVALID_ACCOUNT';end if;
 new.journal_entry_id:=private.post_journal(new.tenant_id,'INV/'||new.id,coalesce(new.created_at,now())::date,'فاتورة '||new.ref_no,'invoice',new.id,
 jsonb_build_array(jsonb_build_object('account',debit_account,'debit',new.amount),jsonb_build_object('account',credit_account,'credit',new.amount)));
 return new;
end $$;
revoke all on function private.invoice_posting() from public;
create trigger invoice_posting before insert on invoices for each row execute function private.invoice_posting();

create function record_invoice_payment(p_invoice_id uuid,p_amount numeric,p_paid_on date,p_reference text,p_cash_account_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare inv public.invoices;paid numeric;result uuid:=gen_random_uuid();cash uuid;contra uuid;e uuid;t uuid:=public.auth_tenant();begin
 if not private.allowed('finance') then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,0));
 select * into inv from public.invoices where id=p_invoice_id and tenant_id=t for update;
 if inv.id is null then raise exception 'INVOICE_NOT_FOUND';end if;
 if not (private.contract_access(inv.contract_id) or (inv.contract_id is null and (private.profile()).scope_district_id is null)) then raise exception 'FORBIDDEN';end if;
 select coalesce(sum(amount),0) into paid from public.payments where invoice_id=inv.id;
 if p_amount is null or p_amount<=0 or p_amount>inv.amount-paid or p_amount='NaN'::numeric then raise exception 'INVALID_PAYMENT';end if;
 select ledger_account_id into cash from public.cash_accounts where id=p_cash_account_id and tenant_id=t;
 if cash is null then raise exception 'CASH_ACCOUNT_REQUIRED';end if;
 if inv.direction='payable' and not private.cash_can_spend(p_cash_account_id,t,p_amount,p_paid_on) then raise exception 'INSUFFICIENT_CASH';end if;
 select id into contra from public.ledger_accounts where tenant_id=t and code=case inv.direction when 'receivable' then '1100' else '2000' end;
 e:=private.post_journal(t,'PAY/'||result,p_paid_on,'سداد فاتورة '||inv.ref_no,'payment',result,
 case inv.direction when 'receivable' then jsonb_build_array(jsonb_build_object('account',cash,'debit',p_amount),jsonb_build_object('account',contra,'credit',p_amount))
 else jsonb_build_array(jsonb_build_object('account',contra,'debit',p_amount),jsonb_build_object('account',cash,'credit',p_amount)) end);
 insert into public.payments(id,tenant_id,invoice_id,amount,paid_on,reference,created_by,cash_account_id,journal_entry_id)
 values(result,t,inv.id,p_amount,p_paid_on,p_reference,auth.uid(),p_cash_account_id,e);
 insert into public.cash_transactions(tenant_id,ref_no,cash_account_id,kind,amount,transaction_date,description,journal_entry_id,created_by)
 values(t,'PAY/'||result,p_cash_account_id,case inv.direction when 'receivable' then 'receipt' else 'payment' end,p_amount,p_paid_on,'سداد '||inv.ref_no,e,auth.uid());
 return result;
end $$;
revoke all on function record_invoice_payment(uuid,numeric,date,text,uuid) from public;
grant execute on function record_invoice_payment(uuid,numeric,date,text,uuid) to authenticated;
-- Preserve the existing SQL API; legacy callers explicitly default to the tenant's cash till.
create or replace function record_payment(p_invoice_id uuid,p_amount numeric,p_paid_on date,p_reference text) returns uuid
language plpgsql security definer set search_path='' as $$ declare c uuid;begin
 select a.id into c from public.cash_accounts a join public.ledger_accounts l on l.id=a.ledger_account_id where a.tenant_id=public.auth_tenant() and l.code='1000';
 return public.record_invoice_payment(p_invoice_id,p_amount,p_paid_on,p_reference,c);end $$;

create function create_cash_transaction(p_kind text,p_ref text,p_cash uuid,p_target uuid,p_category uuid,p_amount numeric,p_date date,p_description text,p_asset uuid default null,p_work uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();cash uuid;contra uuid;e uuid;r uuid:=gen_random_uuid();begin
 if not private.allowed('finance') or (private.profile()).scope_district_id is not null then raise exception 'FORBIDDEN';end if;
 if p_kind not in ('income','expense','transfer','opening') or p_amount is null or p_amount<=0 or p_amount='NaN'::numeric then raise exception 'INVALID_CASH_TRANSACTION';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,0));
 select ledger_account_id into cash from public.cash_accounts where id=p_cash and tenant_id=t;
 if cash is null then raise exception 'CASH_ACCOUNT_REQUIRED';end if;
 if p_asset is not null and not private.asset_access(p_asset) then raise exception 'ASSET_OUT_OF_SCOPE';end if;
 if p_work is not null and not exists(select 1 from public.work_orders where id=p_work and tenant_id=t and (p_asset is null or asset_id=p_asset)) then raise exception 'INVALID_WORK_ORDER';end if;
 if p_kind='transfer' then
  if p_target=p_cash then raise exception 'INVALID_TRANSFER';end if;
  select ledger_account_id into contra from public.cash_accounts where id=p_target and tenant_id=t;
 elsif p_kind='opening' then
  if public.auth_role()<>'admin' or exists(select 1 from public.journal_lines where account_id=cash) then raise exception 'OPENING_BALANCE_ALREADY_USED';end if;
  select id into contra from public.ledger_accounts where tenant_id=t and code='3000';
 else
  select id into contra from public.ledger_accounts where id=p_category and tenant_id=t and active and kind=case p_kind when 'income' then 'revenue' else 'expense' end;
 end if;
 if contra is null then raise exception 'INVALID_ACCOUNT';end if;
 if p_kind in ('expense','transfer') and not private.cash_can_spend(p_cash,t,p_amount,p_date) then raise exception 'INSUFFICIENT_CASH';end if;
 e:=private.post_journal(t,'CASH/'||r,p_date,p_description,'cash',r,
 case when p_kind in ('income','opening') then jsonb_build_array(jsonb_build_object('account',cash,'debit',p_amount),jsonb_build_object('account',contra,'credit',p_amount))
 else jsonb_build_array(jsonb_build_object('account',contra,'debit',p_amount),jsonb_build_object('account',cash,'credit',p_amount)) end);
 insert into public.cash_transactions(id,tenant_id,ref_no,cash_account_id,target_cash_account_id,category_account_id,kind,amount,transaction_date,description,asset_id,work_order_id,journal_entry_id,created_by)
 values(r,t,p_ref,p_cash,case when p_kind='transfer' then p_target end,case when p_kind in ('income','expense') then p_category end,p_kind,p_amount,p_date,p_description,p_asset,p_work,e,auth.uid());
 return r;
end $$;
revoke all on function create_cash_transaction(text,text,uuid,uuid,uuid,numeric,date,text,uuid,uuid) from public;
grant execute on function create_cash_transaction(text,text,uuid,uuid,uuid,numeric,date,text,uuid,uuid) to authenticated;

create function settle_payroll(p_id uuid,p_action text,p_cash uuid default null,p_date date default current_date) returns void
language plpgsql security definer set search_path='' as $$
declare p public.payroll_items;t uuid:=public.auth_tenant();expense uuid;payable uuid;cash uuid;e uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(t::text,0));
 select * into p from public.payroll_items where id=p_id and tenant_id=t for update;
 if p.id is null or not private.employee_access(p.employee_id) then raise exception 'FORBIDDEN';end if;
 if p.net_amount<=0 then raise exception 'INVALID_PAYROLL_AMOUNT';end if;
 select id into payable from public.ledger_accounts where tenant_id=t and code='2100';
 if p_action='approve' then
  if not private.has_role(array['admin','hr']) or p.status<>'draft' then raise exception 'INVALID_PAYROLL_TRANSITION';end if;
  select id into expense from public.ledger_accounts where tenant_id=t and code='5100';
  e:=private.post_journal(t,'SALARY/'||p.id,p.period,'استحقاق راتب','payroll_accrual',p.id,jsonb_build_array(jsonb_build_object('account',expense,'debit',p.net_amount),jsonb_build_object('account',payable,'credit',p.net_amount)));
  update public.payroll_items set status='approved',approved_by=auth.uid(),approval_journal_id=e where id=p.id;
 elsif p_action='pay' then
  if not private.allowed('finance') or p.status<>'approved' then raise exception 'INVALID_PAYROLL_TRANSITION';end if;
  select ledger_account_id into cash from public.cash_accounts where id=p_cash and tenant_id=t;
  if cash is null or not private.cash_can_spend(p_cash,t,p.net_amount,p_date) then raise exception 'INSUFFICIENT_CASH';end if;
  e:=private.post_journal(t,'SALARY-PAY/'||p.id,p_date,'صرف راتب','payroll_payment',p.id,jsonb_build_array(jsonb_build_object('account',payable,'debit',p.net_amount),jsonb_build_object('account',cash,'credit',p.net_amount)));
  update public.payroll_items set status='paid',paid_on=p_date,payment_journal_id=e where id=p.id;
  insert into public.cash_transactions(tenant_id,ref_no,cash_account_id,kind,amount,transaction_date,description,journal_entry_id,created_by)
  values(t,'SALARY/'||p.id,p_cash,'salary',p.net_amount,p_date,'صرف راتب',e,auth.uid());
 else raise exception 'INVALID_ACTION';end if;
end $$;
revoke all on function settle_payroll(uuid,text,uuid,date) from public;
grant execute on function settle_payroll(uuid,text,uuid,date) to authenticated;
commit;
