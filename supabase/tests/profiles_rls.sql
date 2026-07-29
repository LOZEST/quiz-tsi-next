begin;

select plan(9);

select has_table('public', 'profiles', 'profiles exists');
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.profiles'::regclass
  ),
  'RLS is active'
);
select col_is_pk('public', 'profiles', 'user_id', 'user_id is the primary key');
select col_not_null('public', 'profiles', 'email', 'email is required');
select col_not_null('public', 'profiles', 'role', 'role is required');
select policies_are(
  'public',
  'profiles',
  array['authenticated users read their own profile'],
  'only the self-read profile policy exists'
);
select table_privs_are(
  'public',
  'profiles',
  'anon',
  array[]::text[],
  'anonymous has no profile privileges'
);
select table_privs_are(
  'public',
  'profiles',
  'authenticated',
  array['SELECT'],
  'authenticated can only select profiles'
);
select function_privs_are(
  'public',
  'handle_new_user_profile',
  array[]::text[],
  'authenticated',
  array[]::text[],
  'profile trigger is not callable by authenticated users'
);

select * from finish();
rollback;
