-- Run ONLY in the trusted Supabase SQL Editor as the project owner.
-- First invite/create the owner in Authentication > Users. Disable public signup.
-- Replace the UUID below with that confirmed user's UUID. No password goes here.
begin;
do $$
declare owner_id uuid := 'REPLACE_WITH_OWNER_USER_UUID';
begin
 if not exists(select 1 from auth.users where id=owner_id) then raise exception 'Invite the user first'; end if;
 if exists(select 1 from public.staff_roles where role='administrator') then raise exception 'Administrator already exists. Use the authenticated admin interface.'; end if;
 insert into public.profiles(id,rp_name,position) values(owner_id,'SANN Administrator','Administrator');
 insert into public.staff_roles(user_id,role) values(owner_id,'administrator');
 insert into public.audit_logs(actor_id,action,target_id) values(owner_id,'administrator.bootstrapped',owner_id);
end $$;
commit;
