-- Exposes the listing owner's display name to marketplace browsers (the
-- "Auteur" field), and lets an owner publish/unpublish their own quizz
-- listing directly through a single toggle instead of a separate admin-only
-- action. No RLS policy change is needed for either: `profiles` already
-- restricts direct reads to "own row only", and the join below works because
-- these RPCs run `security definer` (same mechanism already used by
-- `admin_list_question_reports` in PR9 to expose another user's profile
-- data). The marketplace tables keep the existing convention: all direct
-- grants stay revoked, RPCs are the only access path.

-- Postgres forbids changing a `returns table(...)` function's output columns
-- via `create or replace` alone; the two listing functions below add
-- `author_display_name` to their result shape, so they must be dropped
-- first. `get_quizz_listing_preview` returns `jsonb` (an unchanged sig), so
-- it stays a plain `create or replace`.
drop function public.list_visible_quizz_listings();

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
  hidden_at timestamptz,
  author_display_name text
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
      l.hidden_at,
      p.display_name
    from public.quizz_listings l
    left join public.profiles p on p.user_id = l.owner_id
    where l.hidden = false
    order by l.published_at desc;
end;
$$;

revoke all on function public.list_visible_quizz_listings() from public, anon;
grant execute on function public.list_visible_quizz_listings() to authenticated;

drop function public.admin_list_quizz_listings();

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
  hidden_at timestamptz,
  author_display_name text
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
      l.hidden_at,
      p.display_name
    from public.quizz_listings l
    left join public.profiles p on p.user_id = l.owner_id
    order by l.published_at desc;
end;
$$;

revoke all on function public.admin_list_quizz_listings() from public, anon;
grant execute on function public.admin_list_quizz_listings() to authenticated;

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
    'authorDisplayName', (select p.display_name from public.profiles p where p.user_id = v_listing.owner_id),
    'questions', v_questions
  );
end;
$$;

revoke all on function public.get_quizz_listing_preview(uuid) from public, anon;
grant execute on function public.get_quizz_listing_preview(uuid) to authenticated;

-- The public/privé switch on a quizz's own card now drives publishing
-- directly (no separate title/description dialog), and can be toggled back
-- and forth. Without an upsert, each "public" toggle would insert a new
-- listing row and orphan the previous one's ratings/subscriptions, silently
-- resetting them on every republish and duplicating the card on the
-- marketplace. Keying on (quizz_id, owner_id) keeps the same listing id
-- (and its rating/subscription history) across repeated toggles.
create or replace function public.submit_quizz_listing(
  p_quizz_id uuid,
  p_title text,
  p_description text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_id uuid;
begin
  if not exists (
    select 1 from public.quizzes where id = p_quizz_id and owner_id = (select auth.uid())
  ) then
    raise exception 'Ce Quizz n''appartient pas à l''utilisateur.' using errcode = '42501';
  end if;

  select id into v_existing_id
    from public.quizz_listings
    where quizz_id = p_quizz_id and owner_id = (select auth.uid());

  if v_existing_id is not null then
    update public.quizz_listings
    set title = p_title,
        description = coalesce(nullif(trim(p_description), ''), ''),
        hidden = false,
        hidden_at = null,
        published_at = now()
    where id = v_existing_id;
  else
    -- Visible immediately: no pending/approved/rejected status gates it.
    insert into public.quizz_listings (quizz_id, owner_id, title, description)
    values (p_quizz_id, (select auth.uid()), p_title, coalesce(nullif(trim(p_description), ''), ''));
  end if;
end;
$$;

revoke all on function public.submit_quizz_listing(uuid, text, text) from public, anon;
grant execute on function public.submit_quizz_listing(uuid, text, text) to authenticated;

-- Self-service counterpart to admin_set_quizz_listing_hidden: lets an owner
-- unpublish their own quizz directly from the same switch that publishes it
-- (submit_quizz_listing above), without an admin role. Keyed by quizz_id
-- rather than listing_id since the frontend only ever tracks the quizz's own
-- id, never the marketplace listing id.
create or replace function public.set_own_quizz_listing_hidden(
  p_quizz_id uuid,
  p_hidden boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.quizz_listings
  set hidden = p_hidden, hidden_at = case when p_hidden then now() else null end
  where quizz_id = p_quizz_id and owner_id = (select auth.uid());
  if not found then
    raise exception 'Listing introuvable.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_own_quizz_listing_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_own_quizz_listing_hidden(uuid, boolean) to authenticated;
