-- Integration test for the actual Supabase database. Executes no network/email calls.
-- ALL accounts, stories and changes are rolled back. Run as trusted project owner.
begin;
create temp table sann_test_ids(name text primary key,id uuid not null);
insert into sann_test_ids select role_name,gen_random_uuid() from unnest(array['administrator','editor_in_chief','senior_journalist','junior_journalist','photographer','outsider']) role_name;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
select id,'authenticated','authenticated','sann-rls-'||id||'@example.invalid','{}','{}' from sann_test_ids;
insert into public.profiles(id,rp_name) select id,'SANN integration test' from sann_test_ids where name<>'outsider';
insert into public.staff_roles(user_id,role) select id,name::public.staff_role from sann_test_ids where name<>'outsider';
grant select,insert,update on sann_test_ids to authenticated,anon;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from sann_test_ids where name='junior_journalist'),true);
do $$begin
 begin
  perform public.save_article(null,0,'{"title":"Cloud RLS test","category":"politics","content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test"}]}]}}','published','');
  raise exception 'FAIL: junior published';
 exception when insufficient_privilege then if sqlerrm<>'Junior cannot publish' then raise; end if; end;
 begin update public.staff_roles set role='administrator'; raise exception 'FAIL: direct role update'; exception when insufficient_privilege then null; end;
 begin perform public.admin_staff(auth.uid(),'Escalation','administrator',true);raise exception 'FAIL: role RPC escalation';exception when insufficient_privilege then if sqlerrm<>'Administrator required' then raise;end if;end;
end $$;
insert into sann_test_ids select 'story',id from public.save_article(null,0,'{"title":"Cloud RLS test","category":"politics","content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test"}]}]}}','draft','');
select id from public.save_article((select id from sann_test_ids where name='story'),1,'{"title":"Cloud RLS test","category":"politics","content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test"}]}]}}','pending_review','');
do $$begin
 begin perform public.save_article((select id from sann_test_ids where name='story'),2,'{}','draft','');raise exception 'FAIL: pending junior edit';exception when insufficient_privilege then if sqlerrm<>'Article is locked for review' then raise;end if;end;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 if exists(select 1 from public.articles where id=(select id from sann_test_ids where name='story')) then raise exception 'FAIL: anonymous draft read';end if;
 begin perform public.save_article(null,0,'{}','published','');raise exception 'FAIL: anonymous write';exception when insufficient_privilege then null;end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from sann_test_ids where name='senior_journalist'),true);
do $$begin
 begin perform public.save_article((select id from sann_test_ids where name='story'),2,'{}','published','');raise exception 'FAIL: foreign edit';exception when insufficient_privilege then if sqlerrm<>'Not your article' then raise;end if;end;
end $$;
select id from public.save_article(null,0,'{"title":"Senior own story","category":"politics","content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test"}]}]}}','published','');

select set_config('request.jwt.claim.sub',(select id::text from sann_test_ids where name='editor_in_chief'),true);
select id from public.save_article((select id from sann_test_ids where name='story'),2,'{"title":"Cloud RLS test","category":"politics","content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test"}]}]}}','changes_requested','Verify source');
select id from public.save_article((select id from sann_test_ids where name='story'),3,'{"title":"Cloud RLS test","category":"politics","content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test"}]}]}}','published','Approved');
do $$begin
 begin perform public.save_article((select id from sann_test_ids where name='story'),3,'{}','archived','');raise exception 'FAIL: stale save';exception when sqlstate 'PT409' then null;end;
end $$;

select set_config('request.jwt.claim.sub',(select id::text from sann_test_ids where name='photographer'),true);
do $$begin
 begin perform public.save_article(null,0,'{}','draft','');raise exception 'FAIL: photographer article';exception when insufficient_privilege then if sqlerrm<>'Article access denied' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from sann_test_ids where name='outsider'),true);
do $$begin
 begin perform public.save_article(null,0,'{}','draft','');raise exception 'FAIL: unapproved staff';exception when insufficient_privilege then if sqlerrm<>'Article access denied' then raise;end if;end;
end $$;

select set_config('request.jwt.claim.sub',(select id::text from sann_test_ids where name='administrator'),true);
select public.admin_staff((select id from sann_test_ids where name='outsider'),'Approved Test','junior_journalist',true);
do $$begin
 if not exists(select 1 from public.audit_logs where action='staff.updated') then raise exception 'FAIL: missing audit';end if;
 begin delete from public.audit_logs;raise exception 'FAIL: audit deletion';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 if not exists(select 1 from public.articles where id=(select id from sann_test_ids where name='story')) then raise exception 'FAIL: published story not visible';end if;
 if exists(select 1 from public.audit_logs) then raise exception 'FAIL: public audit';end if;
end $$;
reset role;
rollback;
select 'PASS: live Supabase role, publication, moderation, conflict and audit assertions; all fixtures rolled back' as result;
