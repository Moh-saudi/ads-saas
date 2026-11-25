-- License validity is mandatory for new/changed active reservations, including admin exceptions.
begin;
alter table public.licenses add column valid_from date,
  add column status text not null default 'active' check(status in ('active','revoked')),
  add constraint license_valid_period check(valid_from is null or valid_from<=expires_on);
-- One authority permit may cover several billboard locations.
alter table public.licenses drop constraint licenses_tenant_id_ref_no_key;
alter table public.licenses add unique(tenant_id,ref_no,asset_id);
create index licenses_asset_period on public.licenses(tenant_id,asset_id,expires_on) where status='active';

create function private.guard_license_booking() returns trigger
language plpgsql security definer set search_path='' as $$
declare covered boolean;
begin
 if new.status<>'active' then return new; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.tenant_id::text,0));
 select coalesce(range_agg(daterange(l.valid_from,l.expires_on,'[]')) @> daterange(new.start_date,new.end_date,'[]'),false)
 into covered from public.licenses l where l.tenant_id=new.tenant_id and l.asset_id=new.asset_id and l.status='active';
 if not covered then raise exception 'LICENSE_PERIOD_CONFLICT'; end if;
 return new;
end $$;
revoke all on function private.guard_license_booking() from public,anon,authenticated;
create trigger zz_license_booking before insert or update on public.contract_lines for each row execute function private.guard_license_booking();

create function private.protect_license_reservations() returns trigger
language plpgsql security definer set search_path='' as $$
declare invalid boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.tenant_id::text,0));
 if tg_op='UPDATE' and new.asset_id=old.asset_id and new.tenant_id=old.tenant_id and new.status=old.status
   and new.valid_from is not distinct from old.valid_from and new.expires_on=old.expires_on then return new; end if;
 select exists(select 1 from public.contract_lines c where c.tenant_id=old.tenant_id and c.asset_id=old.asset_id
  and c.status='active' and c.end_date>=(now() at time zone 'Africa/Cairo')::date
  and not coalesce((select range_agg(daterange(v.valid_from,v.expires_on,'[]')) @> daterange(c.start_date,c.end_date,'[]') from (
   select l.valid_from,l.expires_on from public.licenses l where l.tenant_id=old.tenant_id and l.asset_id=old.asset_id and l.id<>old.id and l.status='active'
   union all select new.valid_from,new.expires_on where tg_op='UPDATE' and new.tenant_id=old.tenant_id and new.asset_id=old.asset_id and new.status='active'
  ) v),false)) into invalid;
 if invalid then raise exception 'LICENSE_HAS_ACTIVE_BOOKINGS'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function private.protect_license_reservations() from public,anon,authenticated;
create trigger protect_license before update or delete on public.licenses for each row execute function private.protect_license_reservations();

create function public.register_asset_licenses(p_assets uuid[],p_ref text,p_issuer text,p_start date,p_end date)
returns integer language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant(); a uuid; n integer:=0;
begin
 if t is null or not private.allowed('assets') then raise exception 'FORBIDDEN'; end if;
 if p_start is null or p_end is null or p_end<p_start or p_start='-infinity'::date or p_end='infinity'::date then raise exception 'INVALID_LICENSE_PERIOD'; end if;
 if nullif(trim(p_ref),'') is null or nullif(trim(p_issuer),'') is null or cardinality(p_assets) is null or cardinality(p_assets)<1 or cardinality(p_assets)>200 then raise exception 'INVALID_LICENSE'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t::text,0));
 for a in select distinct unnest(p_assets) loop
  if not private.asset_access(a) then raise exception 'ASSET_OUT_OF_SCOPE'; end if;
  insert into public.licenses(tenant_id,asset_id,ref_no,issuer,valid_from,expires_on) values(t,a,trim(p_ref),trim(p_issuer),p_start,p_end);
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.register_asset_licenses(uuid[],text,text,date,date) from public,anon;
grant execute on function public.register_asset_licenses(uuid[],text,text,date,date) to authenticated;
commit;
