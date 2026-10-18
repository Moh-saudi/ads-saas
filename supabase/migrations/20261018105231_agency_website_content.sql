begin;
create table public.tenant_website(
 tenant_id uuid primary key references public.tenants,
 content jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.tenant_website enable row level security;
revoke all on public.tenant_website from public,anon,authenticated;
grant select,insert,update on public.tenant_website to authenticated;
create policy website_admin_read on public.tenant_website for select to authenticated
 using(tenant_id=(select public.auth_tenant()) and (select public.auth_role())='admin');
create policy website_admin_insert on public.tenant_website for insert to authenticated
 with check(tenant_id=(select public.auth_tenant()) and (select public.auth_role())='admin');
create policy website_admin_update on public.tenant_website for update to authenticated
 using(tenant_id=(select public.auth_tenant()) and (select public.auth_role())='admin')
 with check(tenant_id=(select public.auth_tenant()) and (select public.auth_role())='admin');
create trigger immutable_tenant before update on public.tenant_website for each row execute function private.immutable_tenant();

create function private.validate_website() returns trigger language plpgsql set search_path='' as $$
declare section text; entry jsonb; field text; link text; limit_rows int;
begin
 if jsonb_typeof(new.content)<>'object' or octet_length(new.content::text)>80000 then raise exception 'INVALID_WEBSITE_CONTENT';end if;
 if length(coalesce(new.content->>'about_title',''))>200 or length(coalesce(new.content->>'about_text',''))>2500 then raise exception 'INVALID_WEBSITE_CONTENT';end if;
 foreach field in array array['about_title','about_text'] loop
  if new.content ? field and jsonb_typeof(new.content->field)<>'string' then raise exception 'INVALID_WEBSITE_CONTENT';end if;
 end loop;
 foreach section in array array['slides','partners','places','projects'] loop
  if new.content ? section then
   limit_rows:=case section when 'slides' then 8 when 'partners' then 24 else 12 end;
   if jsonb_typeof(new.content->section)<>'array' or jsonb_array_length(new.content->section)>limit_rows then raise exception 'INVALID_WEBSITE_CONTENT';end if;
   for entry in select value from jsonb_array_elements(new.content->section) loop
    if jsonb_typeof(entry)<>'object' or length(trim(coalesce(entry->>'title',entry->>'name','')))=0 then raise exception 'INVALID_WEBSITE_CONTENT';end if;
    if length(coalesce(entry->>'title',entry->>'name',''))>200 or length(coalesce(entry->>'description',''))>1500 then raise exception 'INVALID_WEBSITE_CONTENT';end if;
    foreach field in array array['title','name','accent','eyebrow','alt','description','category','image_url','logo_url','website','map_url'] loop
     if entry ? field and jsonb_typeof(entry->field)<>'string' then raise exception 'INVALID_WEBSITE_CONTENT';end if;
    end loop;
    if section='slides' and length(trim(coalesce(entry->>'image_url','')))=0 then raise exception 'INVALID_WEBSITE_CONTENT';end if;
    foreach field in array array['image_url','logo_url','website','map_url'] loop
     link:=coalesce(entry->>field,'');
     if link<>'' and (length(link)>2000 or link !~ '^https://[^[:space:]]+$' and not(field='image_url' and link ~ '^/media/[a-zA-Z0-9/_.-]+$')) then raise exception 'INVALID_WEBSITE_URL';end if;
    end loop;
   end loop;
  end if;
 end loop;
 new.updated_at:=now();return new;
end $$;
revoke all on function private.validate_website() from public,anon,authenticated;
create trigger validate_website before insert or update on public.tenant_website for each row execute function private.validate_website();
create trigger audit_website after insert or update on public.tenant_website for each row execute function private.audit_change();

-- This deliberately exposes only publishable website content for verified, enabled hosts.
create function public.public_website(p_host text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('content',coalesce(w.content,'{}'::jsonb),'areas',coalesce((select jsonb_agg(d.name order by d.name) from public.districts d where d.tenant_id=t.id),'[]'::jsonb))
 from public.tenants t join public.tenant_domains h on h.tenant_id=t.id
 left join public.tenant_website w on w.tenant_id=t.id
 where h.domain=lower(p_host) and h.verified and t.public_site_enabled
 limit 1
$$;
revoke all on function public.public_website(text) from public,anon,authenticated;
grant execute on function public.public_website(text) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('tenant-website','tenant-website',true,2097152,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy website_media_insert on storage.objects for insert to authenticated
 with check(bucket_id='tenant-website' and (storage.foldername(name))[1]=public.auth_tenant()::text and public.auth_role()='admin');
create policy website_media_read on storage.objects for select to authenticated
 using(bucket_id='tenant-website' and (storage.foldername(name))[1]=public.auth_tenant()::text and public.auth_role()='admin');
notify pgrst,'reload schema';
commit;
