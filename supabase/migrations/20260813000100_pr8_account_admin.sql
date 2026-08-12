create or replace function public.set_display_name(p_display_name text)
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text := nullif(trim(p_display_name), '');
begin
  if v_display_name is not null and char_length(v_display_name) > 80 then
    raise exception 'Le nom affiché ne peut pas dépasser 80 caractères.'
      using errcode = '22001';
  end if;
  return query
    update public.profiles
    set display_name = v_display_name
    where user_id = (select auth.uid())
    returning *;
end;
$$;

revoke all on function public.set_display_name(text) from public;
revoke all on function public.set_display_name(text) from anon;
grant execute on function public.set_display_name(text) to authenticated;

create or replace function public.admin_list_profiles()
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role in ('admin', 'owner')
  ) then
    raise exception 'Seuls les administrateurs consultent les comptes.'
      using errcode = '42501';
  end if;
  return query select * from public.profiles order by created_at asc;
end;
$$;

revoke all on function public.admin_list_profiles() from public;
revoke all on function public.admin_list_profiles() from anon;
grant execute on function public.admin_list_profiles() to authenticated;

create or replace function public.owner_set_profile_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role = 'owner'
  ) then
    raise exception 'Seul le propriétaire modifie les rôles.'
      using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'Le propriétaire ne peut pas changer son propre rôle.'
      using errcode = '42501';
  end if;
  if p_role not in ('user', 'admin', 'owner') then
    raise exception 'Rôle invalide.' using errcode = '22023';
  end if;
  update public.profiles
  set role = p_role
  where user_id = p_user_id;
  if not found then
    raise exception 'Compte introuvable.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.owner_set_profile_role(uuid, text) from public;
revoke all on function public.owner_set_profile_role(uuid, text) from anon;
grant execute on function public.owner_set_profile_role(uuid, text) to authenticated;

comment on function public.set_display_name(text) is
  'Lets an authenticated user rename only their own profile.';
comment on function public.admin_list_profiles() is
  'Read-only account directory restricted to admin and owner callers.';
comment on function public.owner_set_profile_role(uuid, text) is
  'Role reassignment restricted to owner callers; self-lockout is blocked.';
