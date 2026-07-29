create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'user'
    constraint profiles_role_check check (role in ('user', 'admin', 'owner')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

create policy "authenticated users read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, role)
  values (new.id, coalesce(new.email, ''), 'user');
  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public;
revoke all on function public.handle_new_user_profile() from anon;
revoke all on function public.handle_new_user_profile() from authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.touch_profile_updated_at() from public;
revoke all on function public.touch_profile_updated_at() from anon;
revoke all on function public.touch_profile_updated_at() from authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.touch_profile_updated_at();

comment on table public.profiles is
  'Minimal account profile. Roles are assigned only through an authorized server-side database operation.';
