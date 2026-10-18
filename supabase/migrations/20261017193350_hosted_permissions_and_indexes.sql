begin;
-- Supabase's hosted default privileges include explicit anon grants, independently of PUBLIC.
revoke all privileges on all tables in schema public from anon;
revoke truncate,references,trigger on all tables in schema public from authenticated;
revoke all on schema private from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from public,anon;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname,p.prorettype
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind='f' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') loop
  if f.proname not in('tenant_by_host','public_catalog','submit_enquiry') then
   execute format('revoke execute on function %s from public,anon',f.signature);
  end if;
  if f.prorettype='trigger'::regtype then execute format('revoke execute on function %s from authenticated',f.signature);end if;
 end loop;
 -- PostGIS statistics helpers are not part of the application API.
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='st_estimatedextent' loop
  execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
-- Extension metadata is read-only; no tenant data is stored here.
revoke all on public.spatial_ref_sys from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_class where oid='public.spatial_ref_sys'::regclass and pg_has_role(current_user,relowner,'USAGE')) then
  alter table public.spatial_ref_sys enable row level security;
  grant select on public.spatial_ref_sys to authenticated;
  create policy spatial_reference_read on public.spatial_ref_sys for select to authenticated using(true);
 end if;
end $$;
create policy domain_operator_only on public.tenant_domains for select to authenticated using(false);
alter policy profiles_read on profiles using(id=(select auth.uid()) or(tenant_id=auth_tenant() and auth_role()='admin'));
alter policy work_create on work_orders with check(tenant_id=auth_tenant() and private.asset_access(asset_id) and private.allowed('assets') and created_by=(select auth.uid()) and status in('open','assigned') and completed_at is null and(assigned_employee_id is null or private.employee_access(assigned_employee_id)));
-- Cover foreign-key lookups only when no existing index has the required leading columns.
do $$ declare c record;cols text;begin
 for c in select co.oid,co.conrelid,co.conkey,co.conname from pg_constraint co join pg_class t on t.oid=co.conrelid join pg_namespace n on n.oid=t.relnamespace
 where co.contype='f' and n.nspname='public' and not exists(
 select 1 from pg_index i where i.indrelid=co.conrelid and i.indisvalid and i.indpred is null
 and(select array_agg(k order by ord) from unnest(i.indkey::smallint[]) with ordinality u(k,ord) where ord<=cardinality(co.conkey))=co.conkey) loop
  select string_agg(quote_ident(a.attname),',' order by u.ord) into cols from unnest(c.conkey) with ordinality u(k,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.k;
  execute format('create index if not exists %I on %s(%s)','fk_'||md5(c.conname||c.conrelid::regclass::text),c.conrelid::regclass,cols);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
