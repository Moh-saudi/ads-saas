begin;
alter table public.inventory_items add column length_m numeric check(length_m>0 and length_m<>'NaN'::numeric),
 add column width_m numeric check(width_m>0 and width_m<>'NaN'::numeric),add column material text;
alter table public.work_orders add column kind text not null default 'maintenance' check(kind in ('installation','removal','maintenance')),
 add column planned_start date,add constraint work_planned_period check(planned_start is null or planned_start<=due_date);
alter table public.purchase_orders add column asset_id uuid,add column work_order_id uuid,
 add column procurement_kind text not null default 'purchase' check(procurement_kind in ('purchase','external_manufacture')),
 add foreign key(tenant_id,asset_id) references public.assets(tenant_id,id),
 add foreign key(tenant_id,work_order_id) references public.work_orders(tenant_id,id);
create policy purchase_asset_scope on public.purchase_orders as restrictive for select to authenticated using(asset_id is null or private.asset_access(asset_id));
create function public.create_asset_purchase(p_ref text,p_supplier uuid,p_warehouse uuid,p_date date,p_expected date,p_lines jsonb,p_notes text,p_asset uuid,p_work uuid,p_kind text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid;t uuid:=public.auth_tenant();w public.work_orders;
begin
 if p_kind not in ('purchase','external_manufacture') or p_kind is null then raise exception 'INVALID_PROCUREMENT_KIND';end if;
 if p_asset is not null and not private.asset_access(p_asset) then raise exception 'ASSET_OUT_OF_SCOPE'; end if;
 if p_work is not null then
  select * into w from public.work_orders where id=p_work and tenant_id=t;
  if w.id is null or not private.asset_access(w.asset_id) or w.asset_id is distinct from p_asset or w.status in ('completed','cancelled') then raise exception 'INVALID_PROCUREMENT_WORK'; end if;
 end if;
 r:=public.create_purchase(p_ref,p_supplier,p_warehouse,p_date,p_expected,p_lines,p_notes);
 update public.purchase_orders set asset_id=p_asset,work_order_id=p_work,procurement_kind=p_kind where id=r and tenant_id=t;
 return r;
end $$;
revoke all on function public.create_asset_purchase(text,uuid,uuid,date,date,jsonb,text,uuid,uuid,text) from public,anon;
grant execute on function public.create_asset_purchase(text,uuid,uuid,date,date,jsonb,text,uuid,uuid,text) to authenticated;
create function public.progress_asset_work(p_id uuid,p_status text,p_resolution text)
returns void language plpgsql security definer set search_path='' as $$
declare w public.work_orders;
begin
 perform public.progress_work_order(p_id,p_status,p_resolution);
 select * into w from public.work_orders where id=p_id and tenant_id=public.auth_tenant();
 if p_status='completed' and w.kind='installation' then
  update public.assets set install_date=coalesce(install_date,(now() at time zone 'Africa/Cairo')::date) where id=w.asset_id and tenant_id=w.tenant_id;
 end if;
end $$;
revoke all on function public.progress_asset_work(uuid,text,text) from public,anon;
grant execute on function public.progress_asset_work(uuid,text,text) to authenticated;
commit;
