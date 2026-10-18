-- Keep retired assets in an RLS-protected register without changing operating KPIs.
begin;
create view public.v_asset_register with(security_invoker=true) as
select a.id,a.tenant_id,a.code,a.street_id,a.type_id,a.status,a.geom,
 d.line_id,d.lease_end,d.monthly_price,d.monthly_cost,d.coverage_end,
 coalesce(d.live_status,'retired') live_status,coalesce(d.chain_conflict,false) chain_conflict,
 s.name street_name,s.district_id,di.name district_name,ty.name type_name,
 a.length_m,a.width_m,a.faces,a.material,a.public_visible,a.notes,
 st_y(a.geom) latitude,st_x(a.geom) longitude,a.cost,a.install_date,a.useful_life_months
from public.assets a
join public.streets s on s.id=a.street_id
join public.districts di on di.id=s.district_id
join public.asset_types ty on ty.id=a.type_id
left join public.v_asset_directory d on d.id=a.id;
revoke all on public.v_asset_register from public,anon,authenticated;
grant select on public.v_asset_register to authenticated;

-- Lock the same asset row used by retirement updates, including concurrent bookings.
create function private.protect_asset_booking() returns trigger
language plpgsql security definer set search_path='' as $$
declare asset_status text;
begin
 if new.status='active' then
  select status into asset_status from public.assets
   where id=new.asset_id and tenant_id=new.tenant_id for update;
  if asset_status='retired' then raise exception 'ASSET_RETIRED';end if;
 end if;
 return new;
end $$;
revoke all on function private.protect_asset_booking() from public,anon,authenticated;
create trigger asset_booking_lifecycle before insert or update on public.contract_lines
for each row execute function private.protect_asset_booking();
notify pgrst,'reload schema';
commit;
