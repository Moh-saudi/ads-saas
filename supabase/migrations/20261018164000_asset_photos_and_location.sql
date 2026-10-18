begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('asset-photos','asset-photos',false,2097152,array['image/png','image/jpeg','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function private.asset_photo_access(object_name text, writing boolean default false)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare parts text[]:=string_to_array(object_name,'/'); a uuid; t uuid:=public.auth_tenant();
begin
 if t is null or array_length(parts,1)<>3 or parts[1]<>t::text or coalesce(parts[3],'')='' then return false;end if;
 begin a:=parts[2]::uuid; exception when invalid_text_representation then return false;end;
 return private.asset_access(a) and (not writing or private.allowed('assets'))
   and exists(select 1 from public.tenant_modules where tenant_id=t and module_key='assets' and enabled);
end $$;
revoke all on function private.asset_photo_access(text,boolean) from public,anon;
grant execute on function private.asset_photo_access(text,boolean) to authenticated;
create policy asset_photo_read on storage.objects for select to authenticated
 using(bucket_id='asset-photos' and private.asset_photo_access(name));
create policy asset_photo_insert on storage.objects for insert to authenticated
 with check(bucket_id='asset-photos' and private.asset_photo_access(name,true));
create policy asset_photo_delete on storage.objects for delete to authenticated
 using(bucket_id='asset-photos' and private.asset_photo_access(name,true));
-- No UPDATE policy: existing originals cannot be overwritten or moved.
create function set_asset_location(p_id uuid,p_latitude double precision,p_longitude double precision,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare t uuid:=public.auth_tenant(); previous public.geometry;
begin
 if not private.allowed('assets') or not private.asset_access(p_id)
 or not exists(select 1 from public.tenant_modules where tenant_id=t and module_key='assets' and enabled) then raise exception 'FORBIDDEN';end if;
 if p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90) or not(p_longitude between -180 and 180) then raise exception 'INVALID_COORDINATES';end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception 'REASON_REQUIRED';end if;
 select geom into previous from public.assets where tenant_id=t and id=p_id for update;
 if not found then raise exception 'FORBIDDEN';end if;
 update public.assets set geom=public.st_setsrid(public.st_makepoint(p_longitude,p_latitude),4326) where tenant_id=t and id=p_id;
 insert into public.audit_events(tenant_id,actor_id,table_name,record_id,operation,changes)
 values(t,auth.uid(),'assets',p_id,'ASSET_LOCATION',jsonb_build_object('reason',trim(p_reason),
 'before',jsonb_build_object('latitude',public.st_y(previous),'longitude',public.st_x(previous)),
 'after',jsonb_build_object('latitude',p_latitude,'longitude',p_longitude)));
end $$;
revoke all on function set_asset_location(uuid,double precision,double precision,text) from public,anon;
grant execute on function set_asset_location(uuid,double precision,double precision,text) to authenticated;
notify pgrst,'reload schema';
commit;
