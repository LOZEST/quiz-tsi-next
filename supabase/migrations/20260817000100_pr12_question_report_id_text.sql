alter table public.question_reports
  alter column question_id type text using question_id::text;

drop function if exists public.create_question_report(uuid, integer, text, text);
drop function if exists public.admin_list_question_reports();

create or replace function public.create_question_report(
  p_question_id text,
  p_question_version integer,
  p_reason text,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_reason not in (
    'math_rendering',
    'question_incorrect',
    'correction_incomplete',
    'hint_unclear',
    'other'
  ) then
    raise exception 'Motif de signalement invalide.' using errcode = '22023';
  end if;
  insert into public.question_reports (
    question_id, question_version, reporter_id, reason, comment
  )
  values (
    p_question_id,
    p_question_version,
    (select auth.uid()),
    p_reason,
    nullif(trim(p_comment), '')
  );
end;
$$;

revoke all on function public.create_question_report(text, integer, text, text) from public;
revoke all on function public.create_question_report(text, integer, text, text) from anon;
grant execute on function public.create_question_report(text, integer, text, text) to authenticated;

create or replace function public.admin_list_question_reports()
returns table (
  id uuid,
  question_id text,
  question_version integer,
  reporter_id uuid,
  reporter_email text,
  reason text,
  comment text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role in ('admin', 'owner')
  ) then
    raise exception 'Seuls les administrateurs consultent les signalements.'
      using errcode = '42501';
  end if;
  return query
    select
      r.id,
      r.question_id,
      r.question_version,
      r.reporter_id,
      p.email,
      r.reason,
      r.comment,
      r.status,
      r.created_at
    from public.question_reports r
    join public.profiles p on p.user_id = r.reporter_id
    order by r.created_at desc;
end;
$$;

revoke all on function public.admin_list_question_reports() from public;
revoke all on function public.admin_list_question_reports() from anon;
grant execute on function public.admin_list_question_reports() to authenticated;

comment on function public.create_question_report(text, integer, text, text) is
  'Lets an authenticated user file a report against a question version.';
comment on function public.admin_list_question_reports() is
  'Read-only question report queue restricted to admin and owner callers.';
