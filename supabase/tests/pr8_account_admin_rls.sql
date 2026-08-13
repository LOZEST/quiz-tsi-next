begin;
select plan(20);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','00000000-0000-0000-0000-000000000000','authenticated','authenticated','d@example.test','',now(),now()),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','00000000-0000-0000-0000-000000000000','authenticated','authenticated','e@example.test','',now(),now()),
('ffffffff-ffff-4fff-8fff-ffffffffffff','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f@example.test','',now(),now());
update public.profiles set role='admin' where user_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
update public.profiles set role='owner' where user_id='ffffffff-ffff-4fff-8fff-ffffffffffff';

select has_function('public', 'set_display_name', array['text'], 'set_display_name exists');
select has_function('public', 'admin_list_profiles', array[]::text[], 'admin_list_profiles exists');
select has_function('public', 'owner_set_profile_role', array['uuid','text'], 'owner_set_profile_role exists');

select function_privs_are('public','set_display_name',array['text'],'anon',array[]::text[],'anon cannot rename profiles');
select function_privs_are('public','admin_list_profiles',array[]::text[],'anon',array[]::text[],'anon cannot list profiles');
select function_privs_are('public','owner_set_profile_role',array['uuid','text'],'anon',array[]::text[],'anon cannot set roles');
select function_privs_are('public','set_display_name',array['text'],'authenticated',array['EXECUTE'],'authenticated can rename profiles');
select function_privs_are('public','admin_list_profiles',array[]::text[],'authenticated',array['EXECUTE'],'authenticated can call admin_list_profiles');
select function_privs_are('public','owner_set_profile_role',array['uuid','text'],'authenticated',array['EXECUTE'],'authenticated can call owner_set_profile_role');

set local role authenticated;

-- D is a plain user.
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
select set_config('request.jwt.claims','{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}',true);
select lives_ok($$select public.set_display_name('Delphine')$$,'D renomme son propre profil');
select is((select display_name from public.profiles where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'Delphine','le nom de D est mis à jour');
select throws_ok($$select public.admin_list_profiles()$$,'42501',null,'D ne consulte pas la liste des comptes');
select throws_ok($$select public.owner_set_profile_role('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','admin')$$,'42501',null,'D ne change pas les rôles');

-- E is an admin: can list accounts but cannot reassign roles.
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
select set_config('request.jwt.claims','{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}',true);
select lives_ok($$select public.admin_list_profiles()$$,'E (admin) consulte la liste des comptes');
select is((select count(*)::integer from public.admin_list_profiles()),3,'E voit les 3 comptes');
select throws_ok($$select public.owner_set_profile_role('dddddddd-dddd-4ddd-8ddd-dddddddddddd','admin')$$,'42501',null,'E (admin) ne change pas les rôles');

-- F is the owner: can reassign roles but not lock themselves out or set an invalid role.
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-ffffffffffff',true);
select set_config('request.jwt.claims','{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff"}',true);
select lives_ok($$select public.owner_set_profile_role('dddddddd-dddd-4ddd-8ddd-dddddddddddd','admin')$$,'F (owner) promeut D');
select is((select role from public.admin_list_profiles() where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'admin','D est désormais admin');
select throws_ok($$select public.owner_set_profile_role('ffffffff-ffff-4fff-8fff-ffffffffffff','admin')$$,'42501',null,'F ne peut pas changer son propre rôle');
select throws_ok($$select public.owner_set_profile_role('dddddddd-dddd-4ddd-8ddd-dddddddddddd','superadmin')$$,'22023',null,'un rôle invalide est refusé');

select * from finish();
rollback;
