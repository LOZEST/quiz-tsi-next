create table public.quizz_listings (
  id uuid primary key default gen_random_uuid(),
  quizz_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  certified boolean not null default false,
  hidden boolean not null default false,
  published_at timestamptz not null default now(),
  certified_at timestamptz,
  hidden_at timestamptz,
  -- Inert placeholders for a future (not yet designed) economic model. Never
  -- read/written by any live code path today: price_coins has no promo/variation
  -- logic, quality_score is never computed, purchase_count is never incremented
  -- by "subscribe" (which stays free and is not a purchase).
  price_coins integer not null default 100,
  quality_score numeric,
  purchase_count integer not null default 0
);

create table public.quizz_ratings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.quizz_listings(id) on delete cascade,
  rater_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (listing_id, rater_id)
);

-- Grants read/play access to the original quizz by reference: no quizz,
-- chapter, notion, or question row is ever copied when a user subscribes.
create table public.quizz_listing_subscriptions (
  listing_id uuid not null references public.quizz_listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscribed_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

alter table public.quizz_listings enable row level security;
alter table public.quizz_ratings enable row level security;
alter table public.quizz_listing_subscriptions enable row level security;

-- No direct table access policies on the marketplace tables themselves: all
-- reads and writes go through the security-definer RPCs below, matching the
-- question_reports (PR9) convention.

revoke all on table public.quizz_listings from anon, authenticated;
revoke all on table public.quizz_ratings from anon, authenticated;
revoke all on table public.quizz_listing_subscriptions from anon, authenticated;

create or replace function public.submit_quizz_listing(
  p_quizz_id uuid,
  p_title text,
  p_description text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.quizzes where id = p_quizz_id and owner_id = (select auth.uid())
  ) then
    raise exception 'Ce Quizz n''appartient pas à l''utilisateur.' using errcode = '42501';
  end if;
  -- Visible immediately: no pending/approved/rejected status gates it.
  insert into public.quizz_listings (quizz_id, owner_id, title, description)
  values (p_quizz_id, (select auth.uid()), p_title, coalesce(nullif(trim(p_description), ''), ''));
end;
$$;

revoke all on function public.submit_quizz_listing(uuid, text, text) from public, anon;
grant execute on function public.submit_quizz_listing(uuid, text, text) to authenticated;

create or replace function public.list_visible_quizz_listings()
returns table (
  id uuid,
  quizz_id uuid,
  owner_id uuid,
  title text,
  description text,
  certified boolean,
  hidden boolean,
  average_rating numeric,
  rating_count bigint,
  published_at timestamptz,
  certified_at timestamptz,
  hidden_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    select
      l.id,
      l.quizz_id,
      l.owner_id,
      l.title,
      l.description,
      l.certified,
      l.hidden,
      (select avg(r.score) from public.quizz_ratings r where r.listing_id = l.id),
      (select count(*) from public.quizz_ratings r where r.listing_id = l.id),
      l.published_at,
      l.certified_at,
      l.hidden_at
    from public.quizz_listings l
    where l.hidden = false
    order by l.published_at desc;
end;
$$;

revoke all on function public.list_visible_quizz_listings() from public, anon;
grant execute on function public.list_visible_quizz_listings() to authenticated;

create or replace function public.get_quizz_listing_preview(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.quizz_listings%rowtype;
  v_questions jsonb;
begin
  select * into v_listing from public.quizz_listings where id = p_listing_id and hidden = false;
  if v_listing.id is null then
    raise exception 'Listing introuvable.' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id,
      'prompt', q.content->'prompt',
      'correction', q.content->'correction'
    )), '[]'::jsonb)
    into v_questions
    from public.latest_accessible_questions q
    where q.owner_id = v_listing.owner_id
      and q.classification->>'kind' = 'personal'
      and q.classification->>'courseId' = v_listing.quizz_id::text;
  return jsonb_build_object(
    'listingId', v_listing.id,
    'title', v_listing.title,
    'description', v_listing.description,
    'certified', v_listing.certified,
    'averageRating', (select avg(r.score) from public.quizz_ratings r where r.listing_id = v_listing.id),
    'ratingCount', (select count(*) from public.quizz_ratings r where r.listing_id = v_listing.id),
    'questions', v_questions
  );
end;
$$;

revoke all on function public.get_quizz_listing_preview(uuid) from public, anon;
grant execute on function public.get_quizz_listing_preview(uuid) to authenticated;

create or replace function public.subscribe_to_quizz_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.quizz_listings where id = p_listing_id and hidden = false
  ) then
    raise exception 'Listing introuvable.' using errcode = 'P0002';
  end if;
  -- Reference access only: this insert is the entire effect of subscribing.
  -- Read/play access to the original quizz/chapters/notions/questions is
  -- granted by the RLS policies below, which check for this row — no data
  -- is copied and price_coins/purchase_count are untouched (stays free).
  insert into public.quizz_listing_subscriptions (listing_id, user_id)
  values (p_listing_id, (select auth.uid()))
  on conflict (listing_id, user_id) do nothing;
end;
$$;

revoke all on function public.subscribe_to_quizz_listing(uuid) from public, anon;
grant execute on function public.subscribe_to_quizz_listing(uuid) to authenticated;

create or replace function public.has_subscribed_to_quizz_listing(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quizz_listing_subscriptions
    where listing_id = p_listing_id and user_id = (select auth.uid())
  );
$$;

revoke all on function public.has_subscribed_to_quizz_listing(uuid) from public, anon;
grant execute on function public.has_subscribed_to_quizz_listing(uuid) to authenticated;

create or replace function public.list_my_quizz_subscriptions()
returns table (
  listing_id uuid,
  quizz_id uuid,
  owner_id uuid,
  title text,
  description text,
  certified boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    select l.id, l.quizz_id, l.owner_id, l.title, l.description, l.certified
    from public.quizz_listing_subscriptions s
    join public.quizz_listings l on l.id = s.listing_id
    where s.user_id = (select auth.uid()) and l.hidden = false
    order by s.subscribed_at desc;
end;
$$;

revoke all on function public.list_my_quizz_subscriptions() from public, anon;
grant execute on function public.list_my_quizz_subscriptions() to authenticated;

create or replace function public.rate_quizz_listing(
  p_listing_id uuid,
  p_score integer,
  p_comment text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_score < 1 or p_score > 5 then
    raise exception 'Note invalide.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.quizz_listing_subscriptions
    where listing_id = p_listing_id and user_id = (select auth.uid())
  ) then
    raise exception 'Seuls les utilisateurs abonnés à ce Quizz peuvent le noter.'
      using errcode = '42501';
  end if;
  insert into public.quizz_ratings (listing_id, rater_id, score, comment)
  values (p_listing_id, (select auth.uid()), p_score, nullif(trim(p_comment), ''))
  on conflict (listing_id, rater_id)
  do update set score = excluded.score, comment = excluded.comment;
end;
$$;

revoke all on function public.rate_quizz_listing(uuid, integer, text) from public, anon;
grant execute on function public.rate_quizz_listing(uuid, integer, text) to authenticated;

create or replace function public.admin_list_quizz_listings()
returns table (
  id uuid,
  quizz_id uuid,
  owner_id uuid,
  title text,
  description text,
  certified boolean,
  hidden boolean,
  average_rating numeric,
  rating_count bigint,
  published_at timestamptz,
  certified_at timestamptz,
  hidden_at timestamptz
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
    raise exception 'Seuls les administrateurs consultent la modération marketplace.'
      using errcode = '42501';
  end if;
  return query
    select
      l.id,
      l.quizz_id,
      l.owner_id,
      l.title,
      l.description,
      l.certified,
      l.hidden,
      (select avg(r.score) from public.quizz_ratings r where r.listing_id = l.id),
      (select count(*) from public.quizz_ratings r where r.listing_id = l.id),
      l.published_at,
      l.certified_at,
      l.hidden_at
    from public.quizz_listings l
    order by l.published_at desc;
end;
$$;

revoke all on function public.admin_list_quizz_listings() from public, anon;
grant execute on function public.admin_list_quizz_listings() to authenticated;

create or replace function public.admin_set_quizz_listing_certified(
  p_listing_id uuid,
  p_certified boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role in ('admin', 'owner')
  ) then
    raise exception 'Seuls les administrateurs certifient un Quizz.'
      using errcode = '42501';
  end if;
  update public.quizz_listings
  set certified = p_certified, certified_at = case when p_certified then now() else null end
  where id = p_listing_id;
  if not found then
    raise exception 'Listing introuvable.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_quizz_listing_certified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_quizz_listing_certified(uuid, boolean) to authenticated;

create or replace function public.admin_set_quizz_listing_hidden(
  p_listing_id uuid,
  p_hidden boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role in ('admin', 'owner')
  ) then
    raise exception 'Seuls les administrateurs modèrent un Quizz.'
      using errcode = '42501';
  end if;
  update public.quizz_listings
  set hidden = p_hidden, hidden_at = case when p_hidden then now() else null end
  where id = p_listing_id;
  if not found then
    raise exception 'Listing introuvable.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_quizz_listing_hidden(uuid, boolean) from public, anon;
grant execute on function public.admin_set_quizz_listing_hidden(uuid, boolean) to authenticated;

comment on column public.quizz_listings.price_coins is 'Inert placeholder for a future economic model; no purchase flow reads or varies this today.';
comment on column public.quizz_listings.quality_score is 'Inert placeholder; never computed by any current code path.';
comment on column public.quizz_listings.purchase_count is 'Inert placeholder; subscribe_to_quizz_listing is free and does not increment this.';

-- Reference-access mechanism: a subscribed user gets real read access to the
-- original quizz's taxonomy and questions, not a copy. This extends the
-- static/owned/shared visibility rules already in place on `questions`, and
-- adds equivalent read-only visibility on the taxonomy tables, gated on an
-- active row in quizz_listing_subscriptions.
drop policy if exists questions_read_accessible on public.questions;
create policy questions_read_accessible on public.questions for select using (
  owner_id = auth.uid() or source = 'static' or (
    source = 'shared' and status = 'published' and validated
    and public.is_latest_question_version(id, version)
  ) or (
    classification->>'kind' = 'personal'
    and exists (
      select 1 from public.quizz_listings l
      join public.quizz_listing_subscriptions s on s.listing_id = l.id
      where l.owner_id = questions.owner_id
        and l.quizz_id = (classification->>'courseId')::uuid
        and s.user_id = (select auth.uid())
    )
  )
);

create policy quizzes_read_subscribed on public.quizzes for select using (
  exists (
    select 1 from public.quizz_listings l
    join public.quizz_listing_subscriptions s on s.listing_id = l.id
    where l.quizz_id = quizzes.id and s.user_id = (select auth.uid())
  )
);

create policy quizz_chapters_read_subscribed on public.quizz_chapters for select using (
  exists (
    select 1 from public.quizz_listings l
    join public.quizz_listing_subscriptions s on s.listing_id = l.id
    where l.quizz_id = quizz_chapters.quizz_id and s.user_id = (select auth.uid())
  )
);

create policy quizz_notions_read_subscribed on public.quizz_notions for select using (
  exists (
    select 1 from public.quizz_listings l
    join public.quizz_listing_subscriptions s on s.listing_id = l.id
    where l.quizz_id = quizz_notions.quizz_id and s.user_id = (select auth.uid())
  )
);
