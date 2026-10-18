-- 0011: itemized invoices, explicit tax rates, administrative depreciation and retirement checks.
begin;
alter table invoices add column net_total numeric(14,2),add column tax_total numeric(14,2) not null default 0,
 add column issue_date date not null default current_date,
 add check(net_total is null or (net_total>=0 and net_total<>'NaN')),
 add check(tax_total>=0 and tax_total<>'NaN'),add check(net_total is null or amount=net_total+tax_total);
create table invoice_lines(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants,invoice_id uuid not null,
 description text not null,quantity numeric(14,3) not null check(quantity>0 and quantity<>'NaN'),
 unit_price numeric(14,4) not null check(unit_price>=0 and unit_price<>'NaN'),
 discount numeric(14,2) not null default 0 check(discount>=0 and discount<>'NaN'),
 tax_rate numeric(5,2) not null default 0 check(tax_rate between 0 and 100),
 net_amount numeric(14,2) generated always as(round(quantity*unit_price-discount,2)) stored,
 tax_amount numeric(14,2) generated always as(round(round(quantity*unit_price-discount,2)*tax_rate/100,2)) stored,
 check(discount<=quantity*unit_price),foreign key(tenant_id,invoice_id) references invoices(tenant_id,id));
alter table invoice_lines enable row level security;
create policy invoice_lines_read on invoice_lines for select to authenticated using(tenant_id=auth_tenant() and exists(select 1 from invoices i where i.id=invoice_id));
revoke all on invoice_lines from anon,authenticated;grant select on invoice_lines to authenticated;
create index on invoice_lines(tenant_id,invoice_id);
create trigger immutable_tenant before update on invoice_lines for each row execute function private.immutable_tenant();
create function private.tax_accounts() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.ledger_accounts(tenant_id,code,name,kind) values(new.id,'1500','ضريبة مشتريات قابلة للتسوية','asset'),(new.id,'2300','ضريبة مبيعات مستحقة','liability') on conflict do nothing;return new;end $$;
revoke all on function private.tax_accounts() from public;
create trigger initialize_tax_accounts after insert on tenants for each row execute function private.tax_accounts();
insert into ledger_accounts(tenant_id,code,name,kind) select t.id,x.code,x.name,x.kind from tenants t cross join(values('1500','ضريبة مشتريات قابلة للتسوية','asset'),('2300','ضريبة مبيعات مستحقة','liability'))x(code,name,kind) on conflict do nothing;

create or replace function private.invoice_posting() returns trigger language plpgsql security definer set search_path='' as $$
declare dr uuid;cr uuid;tax uuid;lines jsonb;begin
 new.net_total:=coalesce(new.net_total,new.amount-new.tax_total);
 if new.direction='receivable' then
  select id into dr from public.ledger_accounts where tenant_id=new.tenant_id and code='1100';
  select id into cr from public.ledger_accounts where tenant_id=new.tenant_id and kind='revenue' and (id=new.category_account_id or(new.category_account_id is null and code='4000'));
  select id into tax from public.ledger_accounts where tenant_id=new.tenant_id and code='2300';
  lines:=jsonb_build_array(jsonb_build_object('account',dr,'debit',new.amount),jsonb_build_object('account',cr,'credit',new.net_total));
  if new.tax_total>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account',tax,'credit',new.tax_total));end if;
 else
  select id into dr from public.ledger_accounts where tenant_id=new.tenant_id and(kind in('expense','asset') or(code='2200' and new.purchase_id is not null)) and(id=new.category_account_id or(new.category_account_id is null and code='5300'));
  select id into cr from public.ledger_accounts where tenant_id=new.tenant_id and code='2000';
  select id into tax from public.ledger_accounts where tenant_id=new.tenant_id and code='1500';
  lines:=jsonb_build_array(jsonb_build_object('account',dr,'debit',new.net_total),jsonb_build_object('account',cr,'credit',new.amount));
  if new.tax_total>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account',tax,'debit',new.tax_total));end if;
 end if;
 if dr is null or cr is null then raise exception 'INVALID_ACCOUNT';end if;
 new.journal_entry_id:=private.post_journal(new.tenant_id,'INV/'||new.id,new.issue_date,'فاتورة '||new.ref_no,'invoice',new.id,lines);return new;
end $$;

create function create_itemized_invoice(p_party uuid,p_direction text,p_ref text,p_issue date,p_due date,p_contract uuid,p_category uuid,p_lines jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();r uuid:=gen_random_uuid();l jsonb;net numeric:=0;tax numeric:=0;line_net numeric;qty numeric;price numeric;discount numeric;rate numeric;begin
 if not private.allowed('finance') then raise exception 'FORBIDDEN';end if;
 if p_contract is not null then
  if not private.contract_access(p_contract) or not exists(select 1 from public.customer_contracts where id=p_contract and tenant_id=t and customer_id=p_party) or p_direction<>'receivable' then raise exception 'INVALID_CONTRACT_INVOICE';end if;
 elsif (private.profile()).scope_district_id is not null then raise exception 'FORBIDDEN';end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 200 then raise exception 'INVALID_LINES';end if;
 for l in select value from jsonb_array_elements(p_lines) loop
  qty:=round((l->>'quantity')::numeric,3);price:=round((l->>'unit_price')::numeric,4);discount:=round(coalesce((l->>'discount')::numeric,0),2);rate:=round(coalesce((l->>'tax_rate')::numeric,0),2);
  if qty is null or price is null or qty<=0 or qty='NaN' or price<0 or price='NaN' or discount<0 or discount>qty*price or discount='NaN' or rate not between 0 and 100 or length(trim(l->>'description'))<1 then raise exception 'INVALID_INVOICE_LINE';end if;
  line_net:=round(qty*price-discount,2);net:=net+line_net;tax:=tax+round(line_net*rate/100,2);
 end loop;
 insert into public.invoices(id,tenant_id,ref_no,party_id,contract_id,direction,amount,due_date,issue_date,category_account_id,net_total,tax_total)
 values(r,t,p_ref,p_party,p_contract,p_direction,net+tax,p_due,p_issue,p_category,net,tax);
 for l in select value from jsonb_array_elements(p_lines) loop
  insert into public.invoice_lines(tenant_id,invoice_id,description,quantity,unit_price,discount,tax_rate)
  values(t,r,l->>'description',round((l->>'quantity')::numeric,3),round((l->>'unit_price')::numeric,4),round(coalesce((l->>'discount')::numeric,0),2),round(coalesce((l->>'tax_rate')::numeric,0),2));
 end loop;return r;
end $$;
revoke all on function create_itemized_invoice(uuid,text,text,date,date,uuid,uuid,jsonb) from public;
grant execute on function create_itemized_invoice(uuid,text,text,date,date,uuid,uuid,jsonb) to authenticated;

alter table assets add check(cost is null or(cost>=0 and cost<>'NaN')),add check(useful_life_months is null or useful_life_months>0);
create or replace view v_asset_directory with(security_invoker=true) as
select v.*,s.name street_name,s.district_id,d.name district_name,ty.name type_name,
 a.length_m,a.width_m,a.faces,a.material,a.public_visible,a.notes,st_y(a.geom) latitude,st_x(a.geom) longitude,
 a.cost,a.install_date,a.useful_life_months
from v_assets_live v join assets a on a.id=v.id join streets s on s.id=v.street_id
join districts d on d.id=s.district_id join asset_types ty on ty.id=v.type_id;
create view v_asset_depreciation with(security_invoker=true) as
select a.tenant_id,a.id,a.code,a.cost,a.install_date,a.useful_life_months,
 round(a.cost/nullif(a.useful_life_months,0),2) monthly_depreciation,
 round(a.cost*least(a.useful_life_months,greatest(0,extract(year from age(current_date,a.install_date))*12+extract(month from age(current_date,a.install_date))))/nullif(a.useful_life_months,0),2) accumulated_depreciation
from assets a where a.cost is not null and a.install_date is not null and a.useful_life_months>0;
grant select on v_asset_depreciation to authenticated;revoke all on v_asset_depreciation from anon;
create function private.protect_retirement() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.status='retired' and old.status<>'retired' and exists(select 1 from public.contract_lines where asset_id=new.id and status='active' and end_date>=current_date) then raise exception 'ASSET_HAS_ACTIVE_LEASES';end if;return new;end $$;
revoke all on function private.protect_retirement() from public;
create trigger protect_retirement before update on assets for each row execute function private.protect_retirement();
commit;
