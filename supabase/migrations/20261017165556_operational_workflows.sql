-- 0009: transactional stock, purchasing, HR, maintenance and customer workflows.
begin;
alter table stock_movements add column return_of uuid,add column journal_entry_id uuid,
 add foreign key(tenant_id,return_of) references stock_movements(tenant_id,id),add foreign key(tenant_id,journal_entry_id) references journal_entries(tenant_id,id);
alter table invoices add column purchase_id uuid,add foreign key(tenant_id,purchase_id) references purchase_orders(tenant_id,id);
create unique index invoices_purchase_once on invoices(tenant_id,purchase_id) where purchase_id is not null;
alter table leave_requests add column period daterange generated always as(daterange(start_date,end_date,'[]')) stored,
 add exclude using gist(employee_id with =,period with &&) where(status='approved');

create function move_stock(p_kind text,p_ref text,p_item uuid,p_from uuid,p_to uuid,p_quantity numeric,p_cost numeric,p_notes text,p_asset uuid default null,p_work uuid default null,p_return uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();qty numeric;val numeric;cost numeric:=p_cost;r uuid;original public.stock_movements;asset uuid:=p_asset;begin
 if not private.has_role(array['admin','storekeeper','area_manager']) then raise exception 'FORBIDDEN';end if;
 if p_quantity is null or p_quantity<=0 or p_quantity='NaN'::numeric then raise exception 'INVALID_QUANTITY';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,0));
 if (p_from is not null and not private.warehouse_access(p_from)) or (p_to is not null and not private.warehouse_access(p_to)) then raise exception 'WAREHOUSE_OUT_OF_SCOPE';end if;
 if not exists(select 1 from public.inventory_items where id=p_item and tenant_id=t and active) then raise exception 'INVALID_ITEM';end if;
 if p_from is not null then
  select coalesce(sum(delta),0),coalesce(sum(delta*unit_cost),0) into qty,val from(
   select quantity delta,unit_cost from public.stock_movements where tenant_id=t and item_id=p_item and to_warehouse_id=p_from
   union all select -quantity,unit_cost from public.stock_movements where tenant_id=t and item_id=p_item and from_warehouse_id=p_from) q;
  if qty<p_quantity then raise exception 'INSUFFICIENT_STOCK';end if;
  cost:=round(val/nullif(qty,0),4);
 end if;
 if p_kind='return' then
  select * into original from public.stock_movements where id=p_return and tenant_id=t and kind='issue';
  if original.id is null or original.item_id<>p_item or not private.warehouse_access(original.from_warehouse_id) or p_quantity>(original.quantity-coalesce((select sum(quantity) from public.stock_movements where return_of=p_return),0)) then raise exception 'INVALID_STOCK_RETURN';end if;
  cost:=original.unit_cost;asset:=original.asset_id;
 elsif p_return is not null then raise exception 'INVALID_STOCK_RETURN';end if;
 if asset is not null and not private.asset_access(asset) then raise exception 'ASSET_OUT_OF_SCOPE';end if;
 if p_work is not null then
  select asset_id into asset from public.work_orders where id=p_work and tenant_id=t and status not in ('completed','cancelled');
  if asset is null or not private.asset_access(asset) or (p_asset is not null and asset<>p_asset) then raise exception 'INVALID_WORK_ORDER';end if;
 end if;
 if length(trim(p_notes))<3 then raise exception 'REASON_REQUIRED';end if;
 insert into public.stock_movements(tenant_id,ref_no,item_id,from_warehouse_id,to_warehouse_id,quantity,unit_cost,kind,asset_id,work_order_id,notes,created_by,return_of)
 values(t,p_ref,p_item,p_from,p_to,p_quantity,cost,p_kind,asset,p_work,p_notes,auth.uid(),p_return) returning id into r;
 return r;
end $$;
revoke all on function move_stock(text,text,uuid,uuid,uuid,numeric,numeric,text,uuid,uuid,uuid) from public;
grant execute on function move_stock(text,text,uuid,uuid,uuid,numeric,numeric,text,uuid,uuid,uuid) to authenticated;

create function private.post_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare inv uuid;contra uuid;amount numeric:=round(new.quantity*new.unit_cost,2);begin
 if new.kind='transfer' or amount=0 then return new;end if;
 select id into inv from public.ledger_accounts where tenant_id=new.tenant_id and code='1400';
 select id into contra from public.ledger_accounts where tenant_id=new.tenant_id and code=case
 when new.kind='receipt' and new.purchase_id is not null then '2200' when new.kind='receipt' then '3000'
 when new.kind='adjustment_in' then '4200' when new.kind='adjustment_out' then '5400' else '5200' end;
 new.journal_entry_id:=private.post_journal(new.tenant_id,'STOCK/'||new.id,(new.created_at at time zone 'Africa/Cairo')::date,new.notes,'stock',new.id,
 case when new.kind in ('receipt','return','adjustment_in') then jsonb_build_array(jsonb_build_object('account',inv,'debit',amount),jsonb_build_object('account',contra,'credit',amount))
 else jsonb_build_array(jsonb_build_object('account',contra,'debit',amount),jsonb_build_object('account',inv,'credit',amount)) end);
 return new;
end $$;
revoke all on function private.post_stock() from public;
create trigger post_stock before insert on stock_movements for each row execute function private.post_stock();

create function create_purchase(p_ref text,p_supplier uuid,p_warehouse uuid,p_date date,p_expected date,p_lines jsonb,p_notes text) returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();r uuid:=gen_random_uuid();l jsonb;begin
 if not private.has_role(array['admin','storekeeper','area_manager']) or not private.warehouse_access(p_warehouse) then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.parties where tenant_id=t and id=p_supplier and type='supplier') then raise exception 'INVALID_SUPPLIER';end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 200 then raise exception 'INVALID_LINES';end if;
 insert into public.purchase_orders(id,tenant_id,ref_no,supplier_id,warehouse_id,ordered_on,expected_on,notes,created_by)
 values(r,t,p_ref,p_supplier,p_warehouse,p_date,p_expected,p_notes,auth.uid());
 for l in select value from jsonb_array_elements(p_lines) loop
  insert into public.purchase_lines(tenant_id,purchase_id,item_id,quantity,unit_cost)
  values(t,r,(l->>'item_id')::uuid,(l->>'quantity')::numeric,(l->>'unit_cost')::numeric);
 end loop;return r;
end $$;
create function receive_purchase(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.purchase_orders;l public.purchase_lines;t uuid:=public.auth_tenant();begin
 if not private.has_role(array['admin','storekeeper','area_manager']) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,0));
 select * into p from public.purchase_orders where id=p_id and tenant_id=t for update;
 if p.id is null or not private.warehouse_access(p.warehouse_id) then raise exception 'FORBIDDEN';end if;
 if p.status<>'ordered' then raise exception 'PURCHASE_ALREADY_PROCESSED';end if;
 for l in select * from public.purchase_lines where purchase_id=p.id loop
  insert into public.stock_movements(tenant_id,ref_no,item_id,to_warehouse_id,quantity,unit_cost,kind,purchase_id,notes,created_by)
  values(t,'PO/'||l.id,l.item_id,p.warehouse_id,l.quantity,l.unit_cost,'receipt',p.id,'استلام أمر شراء '||p.ref_no,auth.uid());
 end loop;
 update public.purchase_orders set status='received',received_at=now() where id=p.id;
end $$;
create function invoice_purchase(p_id uuid,p_ref text,p_due date) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.purchase_orders;t uuid:=public.auth_tenant();r uuid;a uuid;amount numeric;begin
 if not private.allowed('finance') or (private.profile()).scope_district_id is not null then raise exception 'FORBIDDEN';end if;
 select * into p from public.purchase_orders where id=p_id and tenant_id=t for update;
 if p.id is null or p.status<>'received' then raise exception 'PURCHASE_NOT_RECEIVED';end if;
 select sum(quantity*unit_cost) into amount from public.purchase_lines where purchase_id=p.id;
 select id into a from public.ledger_accounts where tenant_id=t and code='2200';
 insert into public.invoices(tenant_id,ref_no,party_id,direction,amount,due_date,purchase_id,category_account_id)
 values(t,p_ref,p.supplier_id,'payable',amount,p_due,p.id,a) returning id into r;return r;
end $$;
revoke all on function create_purchase(text,uuid,uuid,date,date,jsonb,text),receive_purchase(uuid),invoice_purchase(uuid,text,date) from public;
grant execute on function create_purchase(text,uuid,uuid,date,date,jsonb,text),receive_purchase(uuid),invoice_purchase(uuid,text,date) to authenticated;
-- Goods-received clearing is a liability debit when the supplier invoice arrives.
create or replace function private.invoice_posting() returns trigger language plpgsql security definer set search_path='' as $$
declare debit_account uuid;credit_account uuid;begin
 if new.direction='receivable' then
  select id into debit_account from public.ledger_accounts where tenant_id=new.tenant_id and code='1100';
  select id into credit_account from public.ledger_accounts where tenant_id=new.tenant_id and kind='revenue' and (id=new.category_account_id or (new.category_account_id is null and code='4000'));
 else
  select id into debit_account from public.ledger_accounts where tenant_id=new.tenant_id and (kind in ('expense','asset') or (code='2200' and new.purchase_id is not null)) and (id=new.category_account_id or (new.category_account_id is null and code='5300'));
  select id into credit_account from public.ledger_accounts where tenant_id=new.tenant_id and code='2000';
 end if;
 if debit_account is null or credit_account is null then raise exception 'INVALID_ACCOUNT';end if;
 new.journal_entry_id:=private.post_journal(new.tenant_id,'INV/'||new.id,(coalesce(new.created_at,now()) at time zone 'Africa/Cairo')::date,'فاتورة '||new.ref_no,'invoice',new.id,
 jsonb_build_array(jsonb_build_object('account',debit_account,'debit',new.amount),jsonb_build_object('account',credit_account,'credit',new.amount)));
 return new;
end $$;

create function clock_attendance(p_employee uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();day date;begin
 if not private.employee_access(p_employee) or not (private.employee_self(p_employee) or private.has_role(array['admin','hr'])) then raise exception 'FORBIDDEN';end if;
 select (now() at time zone timezone)::date into day from public.tenants where id=t;
 if p_action='in' then
  if exists(select 1 from public.attendance where tenant_id=t and employee_id=p_employee and check_out is null) then raise exception 'ATTENDANCE_ALREADY_OPEN';end if;
  insert into public.attendance(tenant_id,employee_id,work_date,check_in,recorded_by) values(t,p_employee,day,now(),auth.uid());
 elsif p_action='out' then
  update public.attendance set check_out=now() where id=(select id from public.attendance where tenant_id=t and employee_id=p_employee and check_out is null order by check_in desc limit 1);
  if not found then raise exception 'NO_OPEN_ATTENDANCE';end if;
 else raise exception 'INVALID_ACTION';end if;
end $$;
create function manual_attendance(p_employee uuid,p_day date,p_in time,p_out time,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant();tz text;tin timestamptz;tout timestamptz;begin
 if not private.has_role(array['admin','hr']) or not private.employee_access(p_employee) then raise exception 'FORBIDDEN';end if;
 if length(trim(p_reason))<5 then raise exception 'REASON_REQUIRED';end if;
 select timezone into tz from public.tenants where id=t;
 tin:=(p_day+p_in) at time zone tz;
 tout:=(p_day+p_out+case when p_out<p_in then interval '1 day' else interval '0' end) at time zone tz;
 if tin>now() or tout>now() then raise exception 'FUTURE_ATTENDANCE';end if;
 insert into public.attendance(tenant_id,employee_id,work_date,check_in,check_out,recorded_by,notes)
 values(t,p_employee,p_day,tin,tout,auth.uid(),p_reason)
 on conflict(tenant_id,employee_id,work_date) do update set check_in=excluded.check_in,check_out=excluded.check_out,notes=excluded.notes,recorded_by=excluded.recorded_by;
end $$;
create function request_leave(p_employee uuid,p_start date,p_end date,p_kind text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$ declare r uuid;begin
 if not private.employee_access(p_employee) or not (private.employee_self(p_employee) or private.has_role(array['admin','hr'])) then raise exception 'FORBIDDEN';end if;
 insert into public.leave_requests(tenant_id,employee_id,start_date,end_date,kind,reason) values(public.auth_tenant(),p_employee,p_start,p_end,p_kind,p_reason) returning id into r;return r;
end $$;
create function decide_leave(p_id uuid,p_approve boolean,p_note text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.has_role(array['admin','hr']) then raise exception 'FORBIDDEN';end if;
 update public.leave_requests set status=case when p_approve then 'approved' else 'rejected' end,decided_by=auth.uid(),decision_note=p_note
 where id=p_id and tenant_id=public.auth_tenant() and private.employee_access(employee_id) and status='pending';
 if not found then raise exception 'LEAVE_NOT_PENDING';end if;
end $$;
revoke all on function clock_attendance(uuid,text),manual_attendance(uuid,date,time,time,text),request_leave(uuid,date,date,text,text),decide_leave(uuid,boolean,text) from public;
grant execute on function clock_attendance(uuid,text),manual_attendance(uuid,date,time,time,text),request_leave(uuid,date,date,text,text),decide_leave(uuid,boolean,text) to authenticated;

create function progress_work_order(p_id uuid,p_status text,p_resolution text) returns void language plpgsql security definer set search_path='' as $$
declare w public.work_orders;begin
 select * into w from public.work_orders where id=p_id and tenant_id=public.auth_tenant() for update;
 if w.id is null or not private.asset_access(w.asset_id) or not (private.allowed('assets') or private.employee_self(w.assigned_employee_id)) then raise exception 'FORBIDDEN';end if;
 if not ((w.status in ('open','assigned') and p_status in ('in_progress','cancelled')) or (w.status='in_progress' and p_status in ('completed','cancelled'))) then raise exception 'INVALID_WORK_TRANSITION';end if;
 if p_status in ('completed','cancelled') and length(trim(p_resolution))<5 then raise exception 'REASON_REQUIRED';end if;
 update public.work_orders set status=p_status,resolution=p_resolution,completed_at=case when p_status='completed' then now() end where id=w.id;
end $$;
create function record_inspection(p_asset uuid,p_condition text,p_method text,p_tag text,p_notes text,p_lat double precision default null,p_lng double precision default null) returns uuid
language plpgsql security definer set search_path='' as $$ declare r uuid;t uuid:=public.auth_tenant();begin
 if not private.allowed('incidents') or not private.asset_access(p_asset) then raise exception 'FORBIDDEN';end if;
 if p_method in ('qr','nfc') and not exists(select 1 from public.asset_tags where tenant_id=t and asset_id=p_asset and uid=p_tag and active and kind=p_method) then raise exception 'INVALID_ASSET_TAG';end if;
 insert into public.inspections(tenant_id,asset_id,inspector_id,condition,method,tag_uid,notes,latitude,longitude)
 values(t,p_asset,auth.uid(),p_condition,p_method,p_tag,p_notes,p_lat,p_lng) returning id into r;
 if p_condition<>'good' then
  insert into public.asset_incidents(tenant_id,asset_id,kind,description,severity) values(t,p_asset,p_condition,p_notes,case when p_condition='missing' then 3 else 2 end);
 end if;return r;
end $$;
revoke all on function progress_work_order(uuid,text,text),record_inspection(uuid,text,text,text,text,double precision,double precision) from public;
grant execute on function progress_work_order(uuid,text,text),record_inspection(uuid,text,text,text,text,double precision,double precision) to authenticated;

create function cancel_customer_contract(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.allowed('sales') or not private.contract_access(p_id) or length(trim(p_reason))<5 then raise exception 'FORBIDDEN_OR_REASON_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(public.auth_tenant()::text,0));
 update public.contract_lines set status='cancelled' where contract_id=p_id and tenant_id=public.auth_tenant();
 update public.customer_contracts set status='cancelled' where id=p_id and tenant_id=public.auth_tenant();
 insert into public.audit_events(tenant_id,actor_id,table_name,record_id,operation,changes)
 values(public.auth_tenant(),auth.uid(),'customer_contracts',p_id,'CANCEL_REASON',jsonb_build_object('reason',p_reason));
end $$;
revoke all on function cancel_customer_contract(uuid,text) from public;
grant execute on function cancel_customer_contract(uuid,text) to authenticated;

create function submit_enquiry(p_host text,p_name text,p_phone text,p_email text,p_message text,p_asset_code text default null) returns void
language plpgsql security definer set search_path='' as $$ declare t uuid;begin
 select td.tenant_id into t from public.tenant_domains td join public.tenants te on te.id=td.tenant_id where td.domain=lower(p_host) and td.verified and te.public_site_enabled;
 if t is null or length(trim(p_name)) not between 2 and 150 or length(p_phone) not between 8 and 25 or length(p_message) not between 5 and 2000 then raise exception 'INVALID_ENQUIRY';end if;
 perform pg_advisory_xact_lock(hashtextextended('enquiry:'||t::text,0));
 if (select count(*) from public.enquiries where tenant_id=t and created_at>now()-interval '1 day')>=100 or
 (select count(*) from public.enquiries where tenant_id=t and phone=p_phone and created_at>now()-interval '1 day')>=3 then raise exception 'ENQUIRY_RATE_LIMIT';end if;
 insert into public.enquiries(tenant_id,full_name,phone,email,message,asset_code) values(t,trim(p_name),p_phone,left(p_email,200),p_message,p_asset_code);
end $$;
create function update_enquiry(p_id uuid,p_status text,p_notes text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.allowed('sales') then raise exception 'FORBIDDEN';end if;
 update public.enquiries set status=p_status,notes=p_notes where id=p_id and tenant_id=public.auth_tenant();
 if not found then raise exception 'ENQUIRY_NOT_FOUND';end if;
end $$;
revoke all on function submit_enquiry(text,text,text,text,text,text),update_enquiry(uuid,text,text) from public;
grant execute on function submit_enquiry(text,text,text,text,text,text) to anon,authenticated;
grant execute on function update_enquiry(uuid,text,text) to authenticated;

-- Activate new modules for existing companies, without enabling external messaging.
insert into tenant_modules(tenant_id,module_key,enabled)
select t.id,k,true from tenants t cross join unnest(array['employees','attendance','payroll','inventory','purchases','maintenance','inspections','cashbook','reports','leads','audit']) k on conflict do nothing;
commit;
