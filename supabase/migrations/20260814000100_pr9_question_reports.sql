create table public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  question_version integer not null check (question_version > 0),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (
    reason in (
      'math_rendering',
      'question_incorrect',
      'correction_incomplete',
      'hint_unclear',
      'other'
    )
  ),
  comment text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.question_reports enable row level security;

create policy question_reports_insert_own on public.question_reports
  for insert
  with check (reporter_id = (select auth.uid()));

revoke all on table public.question_reports from anon;
revoke all on table public.question_reports from authenticated;
grant insert on table public.question_reports to authenticated;

create or replace function public.create_question_report(
  p_question_id uuid,
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

revoke all on function public.create_question_report(uuid, integer, text, text) from public;
revoke all on function public.create_question_report(uuid, integer, text, text) from anon;
grant execute on function public.create_question_report(uuid, integer, text, text) to authenticated;

create or replace function public.admin_list_question_reports()
returns table (
  id uuid,
  question_id uuid,
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

create or replace function public.admin_set_question_report_status(
  p_report_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role in ('admin', 'owner')
  ) then
    raise exception 'Seuls les administrateurs modifient les signalements.'
      using errcode = '42501';
  end if;
  if p_status not in ('open', 'in_progress', 'resolved', 'dismissed') then
    raise exception 'Statut invalide.' using errcode = '22023';
  end if;
  update public.question_reports
  set status = p_status, updated_at = now()
  where id = p_report_id;
  if not found then
    raise exception 'Signalement introuvable.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_question_report_status(uuid, text) from public;
revoke all on function public.admin_set_question_report_status(uuid, text) from anon;
grant execute on function public.admin_set_question_report_status(uuid, text) to authenticated;

comment on function public.create_question_report(uuid, integer, text, text) is
  'Lets an authenticated user file a report against a question version.';
comment on function public.admin_list_question_reports() is
  'Read-only question report queue restricted to admin and owner callers.';
comment on function public.admin_set_question_report_status(uuid, text) is
  'Report status transition restricted to admin and owner callers.';
