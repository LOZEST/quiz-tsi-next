alter table public.personal_courses
  add column description text not null default '',
  add column visibility text not null default 'private' check (visibility in ('public', 'private'));

grant update on table public.personal_courses to authenticated;
