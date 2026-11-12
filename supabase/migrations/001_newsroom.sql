begin;
create schema private;
revoke all on schema private from public;
grant usage on schema private to anon,authenticated;
create type public.staff_role as enum ('administrator','editor_in_chief','senior_journalist','junior_journalist','photographer');
create type public.article_status as enum ('draft','pending_review','changes_requested','published','archived');
create table public.profiles (
 id uuid primary key references auth.users(id), rp_name text not null check(length(rp_name) between 1 and 100),
 avatar text not null default '', position text not null default 'Correspondent', biography text not null default '',
 department text not null default 'News', joined_at timestamptz not null default now()
);
create table public.staff_roles (user_id uuid primary key references public.profiles(id), role public.staff_role not null, active boolean not null default true);
create table public.categories (slug text primary key, name text not null);
insert into public.categories values ('breaking-news','Breaking News'),('crime-justice','Crime & Justice'),('politics','Politics'),('business','Business'),('investigations','Investigations'),('entertainment','Entertainment'),('lifestyle','Lifestyle'),('interviews','Interviews');
create table public.articles (
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{0,179}$'),
 author_id uuid not null references public.profiles(id), title text not null check(length(title) between 1 and 240),
 subtitle text not null default '' check(length(subtitle)<=500), category text not null references public.categories(slug),
 content jsonb not null default '{"type":"doc","content":[]}', cover_path text, cover_caption text not null default '',
 status public.article_status not null default 'draft', featured boolean not null default false, is_demo boolean not null default false,
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz,
 check(jsonb_typeof(content)='object' and content->>'type'='doc' and octet_length(content::text)<1000000)
);
create index articles_public_feed on public.articles(status,published_at desc);
create index articles_author on public.articles(author_id);
create index articles_category on public.articles(category,status);
create table public.article_tags(article_id uuid references public.articles(id) on delete cascade, tag text check(length(tag) between 1 and 50), primary key(article_id,tag));
create table public.media_assets(path text primary key, owner_id uuid not null references public.profiles(id), caption text not null default '', deleting boolean not null default false, created_at timestamptz not null default now());
create table public.article_media(article_id uuid references public.articles(id) on delete cascade, path text references public.media_assets(path), primary key(article_id,path));
create table public.editorial_reviews(id bigint generated always as identity primary key, article_id uuid not null references public.articles(id), actor_id uuid not null references public.profiles(id), from_status public.article_status, to_status public.article_status not null, comment text not null default '', created_at timestamptz not null default now());
create table public.audit_logs(id bigint generated always as identity primary key, actor_id uuid, action text not null, target_id uuid, detail jsonb not null default '{}', created_at timestamptz not null default now());
create table public.site_settings(key text primary key, value text not null);
insert into public.site_settings values ('tagline','Independent reporting. Across San Andreas.'),('about','An independent fictional news agency for one GTA RolePlay community. Our stories take place inside San Andreas.');

create function private.my_role() returns public.staff_role language sql stable security definer set search_path='' as $$ select role from public.staff_roles where user_id=auth.uid() and active $$;
create function private.is_editor() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.my_role() in ('administrator','editor_in_chief'),false) $$;
create function private.can_read_article(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.articles where id=p_id and (status='published' or (private.my_role() is not null and (author_id=auth.uid() or private.is_editor())))) $$;
create function private.can_read_media(p_path text) returns boolean language sql stable security definer set search_path='' as $$ select private.my_role() is not null or exists(select 1 from public.article_media m join public.articles a on a.id=m.article_id where m.path=p_path and a.status='published') $$;

alter table public.profiles enable row level security;
alter table public.staff_roles enable row level security;
alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.article_tags enable row level security;
alter table public.media_assets enable row level security;
alter table public.article_media enable row level security;
alter table public.editorial_reviews enable row level security;
alter table public.audit_logs enable row level security;
alter table public.site_settings enable row level security;
create policy profiles_read on public.profiles for select using (true);
create policy roles_read on public.staff_roles for select to authenticated using(user_id=(select auth.uid()) or (select private.my_role())='administrator');
create policy categories_read on public.categories for select using(true);
create policy articles_read on public.articles for select using(status='published' or ((select private.my_role()) is not null and (author_id=(select auth.uid()) or (select private.is_editor()))));
create policy tags_read on public.article_tags for select using(private.can_read_article(article_id));
create policy media_read on public.media_assets for select using(private.can_read_media(path));
create policy article_media_read on public.article_media for select using(private.can_read_article(article_id));
create policy reviews_read on public.editorial_reviews for select to authenticated using((select private.my_role()) is not null and private.can_read_article(article_id));
create policy audit_read on public.audit_logs for select to authenticated using((select private.my_role())='administrator');
create policy settings_read on public.site_settings for select using(true);

-- All writes go through narrowly scoped functions. No direct table write grants.
revoke all on public.profiles,public.staff_roles,public.categories,public.articles,public.article_tags,public.media_assets,public.article_media,public.editorial_reviews,public.audit_logs,public.site_settings from anon,authenticated;
grant select on public.profiles,public.staff_roles,public.categories,public.articles,public.article_tags,public.media_assets,public.article_media,public.editorial_reviews,public.audit_logs,public.site_settings to anon,authenticated;

create function private.save_article(p_id uuid,p_version integer,p_data jsonb,p_status public.article_status,p_comment text default '') returns public.articles language plpgsql security definer set search_path='' as $$
declare r public.staff_role := private.my_role(); old public.articles; result public.articles; target uuid; path_item text;
begin
 if r is null or r='photographer' then raise exception 'Article access denied' using errcode='42501'; end if;
 if p_id is not null then
  select * into old from public.articles where id=p_id for update;
  if not found then raise exception 'Article not found'; end if;
  if p_version is null or old.version<>p_version then raise exception 'Conflict: article changed. Reload before saving.' using errcode='PT409'; end if;
  if not private.is_editor() and old.author_id<>auth.uid() then raise exception 'Not your article' using errcode='42501'; end if;
  if r='junior_journalist' and old.status not in ('draft','changes_requested') then raise exception 'Article is locked for review' using errcode='42501'; end if;
 else
  if p_version<>0 then raise exception 'Invalid version'; end if;
 end if;
 if r='junior_journalist' and p_status not in ('draft','pending_review') then raise exception 'Junior cannot publish' using errcode='42501'; end if;
 if r='senior_journalist' and p_status not in ('draft','pending_review','published','archived') then raise exception 'Editor required' using errcode='42501'; end if;
 if p_status='changes_requested' and length(trim(p_comment))=0 then raise exception 'Review comment required'; end if;
 if p_status='published' and (length(trim(p_data->>'title'))<5 or jsonb_array_length(coalesce(p_data->'content'->'content','[]'))=0) then raise exception 'Title and article body required'; end if;
 target:=coalesce(p_id,gen_random_uuid());
 insert into public.articles(id,slug,author_id,title,subtitle,category,content,cover_path,cover_caption,status,featured,version,published_at)
 values(target,coalesce(old.slug,coalesce(nullif(p_data->>'slug',''),'story-'||target::text)),coalesce(old.author_id,auth.uid()),trim(p_data->>'title'),coalesce(p_data->>'subtitle',''),p_data->>'category',p_data->'content',nullif(p_data->>'cover_path',''),coalesce(p_data->>'cover_caption',''),p_status,case when private.is_editor() then coalesce((p_data->>'featured')::boolean,false) else coalesce(old.featured,false) end,coalesce(old.version,0)+1,case when p_status='published' then coalesce(old.published_at,now()) else old.published_at end)
 on conflict(id) do update set title=excluded.title,subtitle=excluded.subtitle,category=excluded.category,content=excluded.content,cover_path=excluded.cover_path,cover_caption=excluded.cover_caption,status=excluded.status,featured=excluded.featured,version=excluded.version,published_at=excluded.published_at,updated_at=now()
 returning * into result;
 delete from public.article_tags where article_id=target;
 insert into public.article_tags select target,left(trim(value),50) from jsonb_array_elements_text(coalesce(p_data->'tags','[]')) where length(trim(value))>0 on conflict do nothing;
 delete from public.article_media where article_id=target;
 for path_item in select result.cover_path where result.cover_path is not null union select x->'attrs'->>'src' from jsonb_path_query(result.content,'$.** ? (@.type == "image")') x loop
  if result.is_demo and path_item in ('illustration:city','illustration:night','illustration:event') then continue; end if;
  perform 1 from public.media_assets where path=path_item and not deleting for update;
  if not found then raise exception 'Image is missing or being deleted'; end if;
  insert into public.article_media values(target,path_item) on conflict do nothing;
 end loop;
 if p_id is null or old.status<>p_status then insert into public.editorial_reviews(article_id,actor_id,from_status,to_status,comment) values(target,auth.uid(),old.status,p_status,left(p_comment,5000)); end if;
 insert into public.audit_logs(actor_id,action,target_id,detail) values(auth.uid(),'article.saved',target,jsonb_build_object('status',p_status,'version',result.version));
 return result;
end $$;

create function private.admin_staff(p_user_id uuid,p_name text,p_role public.staff_role,p_active boolean default true) returns void language plpgsql security definer set search_path='' as $$
begin
 -- Serializes role changes so concurrent demotions cannot remove all administrators.
 perform pg_advisory_xact_lock(918277);
 if private.my_role()<>'administrator' or private.my_role() is null then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_user_id=auth.uid() and (p_role<>'administrator' or not p_active) then raise exception 'Cannot revoke your own administration'; end if;
 insert into public.profiles(id,rp_name,position) values(p_user_id,p_name,initcap(replace(p_role::text,'_',' '))) on conflict(id) do update set rp_name=excluded.rp_name,position=excluded.position;
 insert into public.staff_roles values(p_user_id,p_role,p_active) on conflict(user_id) do update set role=excluded.role,active=excluded.active;
 insert into public.audit_logs(actor_id,action,target_id,detail) values(auth.uid(),'staff.updated',p_user_id,jsonb_build_object('role',p_role,'active',p_active));
end $$;
create function private.update_profile(p_name text,p_bio text,p_department text,p_avatar text) returns void language plpgsql security definer set search_path='' as $$
begin
 if private.my_role() is null then raise exception 'Active staff required'; end if;
 update public.profiles set rp_name=p_name,biography=left(p_bio,5000),department=left(p_department,100),avatar=left(p_avatar,1000) where id=auth.uid();
end $$;
create function private.update_setting(p_key text,p_value text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_editor() then raise exception 'Editor required'; end if;
 if p_key not in ('about','tagline') then raise exception 'Unknown setting'; end if;
 update public.site_settings set value=left(p_value,10000) where key=p_key;
 insert into public.audit_logs(actor_id,action,detail) values(auth.uid(),'settings.updated',jsonb_build_object('key',p_key));
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('newsroom','newsroom',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy newsroom_download on storage.objects for select using(bucket_id='newsroom' and private.can_read_media(name));
create policy newsroom_upload on storage.objects for insert to authenticated with check(bucket_id='newsroom' and (select private.my_role()) is not null and (storage.foldername(name))[1]=(select auth.uid())::text and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));
create function private.register_media(p_path text,p_caption text) returns void language plpgsql security definer set search_path='' as $$
begin
 if private.my_role() is null or split_part(p_path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='newsroom' and name=p_path and owner_id=auth.uid()::text) then raise exception 'Invalid upload'; end if;
 insert into public.media_assets(path,owner_id,caption) values(p_path,auth.uid(),left(p_caption,1000));
end $$;
-- Reserve deletion under a row lock before calling the Storage API. Article saves
-- take the same lock and refuse reserved assets, including across HTTP requests.
create function private.prepare_media_delete(p_path text) returns void language plpgsql security definer set search_path='' as $$
begin
 if private.my_role() is null then raise exception 'Active staff required'; end if;
 perform 1 from public.media_assets where path=p_path and owner_id=auth.uid() for update;
 if not found then raise exception 'Not your media asset'; end if;
 if exists(select 1 from public.article_media where path=p_path) then raise exception 'Photograph is referenced by a story'; end if;
 update public.media_assets set deleting=true where path=p_path;
end $$;
create function private.can_delete_media(p_path text) returns boolean language sql stable security definer set search_path='' as $$ select private.my_role() is not null and exists(select 1 from public.media_assets where path=p_path and owner_id=auth.uid() and deleting) $$;
create policy newsroom_delete on storage.objects for delete to authenticated using(bucket_id='newsroom' and private.can_delete_media(name));
create function private.forget_media(p_path text) returns void language plpgsql security definer set search_path='' as $$
begin
 if private.my_role() is null then raise exception 'Active staff required'; end if;
 delete from public.media_assets where path=p_path and owner_id=auth.uid() and not exists(select 1 from storage.objects where bucket_id='newsroom' and name=p_path);
end $$;

-- Explicit execute grants: PostgreSQL functions otherwise default to PUBLIC.
revoke execute on function private.my_role(),private.is_editor(),private.can_read_article(uuid),private.can_read_media(text),private.can_delete_media(text),private.save_article(uuid,integer,jsonb,public.article_status,text),private.admin_staff(uuid,text,public.staff_role,boolean),private.update_profile(text,text,text,text),private.update_setting(text,text),private.register_media(text,text),private.prepare_media_delete(text),private.forget_media(text) from public,anon,authenticated;
grant execute on function private.my_role(),private.is_editor(),private.can_read_article(uuid),private.can_read_media(text) to anon,authenticated;
grant execute on function private.can_delete_media(text),private.save_article(uuid,integer,jsonb,public.article_status,text),private.admin_staff(uuid,text,public.staff_role,boolean),private.update_profile(text,text,text,text),private.update_setting(text,text),private.register_media(text,text),private.prepare_media_delete(text),private.forget_media(text) to authenticated;

-- Data API wrappers are SECURITY INVOKER. Privileged implementations stay outside exposed schemas.
create function public.save_article(p_id uuid,p_version integer,p_data jsonb,p_status public.article_status,p_comment text default '') returns public.articles language sql security invoker set search_path='' as $$ select private.save_article(p_id,p_version,p_data,p_status,p_comment) $$;
revoke execute on function public.save_article(uuid,integer,jsonb,public.article_status,text) from public,anon,authenticated;
grant execute on function public.save_article(uuid,integer,jsonb,public.article_status,text) to authenticated;
create function public.admin_staff(p_user_id uuid,p_name text,p_role public.staff_role,p_active boolean default true) returns void language sql security invoker set search_path='' as $$ select private.admin_staff(p_user_id,p_name,p_role,p_active) $$;
revoke execute on function public.admin_staff(uuid,text,public.staff_role,boolean) from public,anon,authenticated;
grant execute on function public.admin_staff(uuid,text,public.staff_role,boolean) to authenticated;
create function public.update_profile(p_name text,p_bio text,p_department text,p_avatar text) returns void language sql security invoker set search_path='' as $$ select private.update_profile(p_name,p_bio,p_department,p_avatar) $$;
revoke execute on function public.update_profile(text,text,text,text) from public,anon,authenticated;
grant execute on function public.update_profile(text,text,text,text) to authenticated;
create function public.update_setting(p_key text,p_value text) returns void language sql security invoker set search_path='' as $$ select private.update_setting(p_key,p_value) $$;
revoke execute on function public.update_setting(text,text) from public,anon,authenticated;
grant execute on function public.update_setting(text,text) to authenticated;
create function public.register_media(p_path text,p_caption text) returns void language sql security invoker set search_path='' as $$ select private.register_media(p_path,p_caption) $$;
revoke execute on function public.register_media(text,text) from public,anon,authenticated;
grant execute on function public.register_media(text,text) to authenticated;
create function public.prepare_media_delete(p_path text) returns void language sql security invoker set search_path='' as $$ select private.prepare_media_delete(p_path) $$;
revoke execute on function public.prepare_media_delete(text) from public,anon,authenticated;
grant execute on function public.prepare_media_delete(text) to authenticated;
create function public.forget_media(p_path text) returns void language sql security invoker set search_path='' as $$ select private.forget_media(p_path) $$;
revoke execute on function public.forget_media(text) from public,anon,authenticated;
grant execute on function public.forget_media(text) to authenticated;
create index media_assets_owner on public.media_assets(owner_id);
create index article_media_path on public.article_media(path);
create index editorial_reviews_article on public.editorial_reviews(article_id,created_at desc);
create index editorial_reviews_actor on public.editorial_reviews(actor_id);
create index audit_logs_created on public.audit_logs(created_at desc);
commit;
