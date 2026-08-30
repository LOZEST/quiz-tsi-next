-- Fix: get_quizz_listing_preview exposed every personal question tagged to
-- the listed quizz, including drafts that are neither validated nor
-- published. A quizz with e.g. 100 draft questions and zero validated ones
-- could be published and would show up on the marketplace as "100
-- questions" — but a subscriber who actually starts a revision session gets
-- none of them, because the client-side revision pool (AppServicesProvider's
-- refreshQuestionRepositoryForUser) already filters to
-- status = 'published' and validated. Apply that same filter here so the
-- preview only ever shows content a subscriber could actually play.
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
      'prompt', coalesce(nullif(q.content->'prompt', 'null'::jsonb), '[]'::jsonb),
      'correction', coalesce(nullif(q.content->'correction', 'null'::jsonb), '[]'::jsonb)
    )), '[]'::jsonb)
    into v_questions
    from public.latest_accessible_questions q
    where q.owner_id = v_listing.owner_id
      and q.classification->>'kind' = 'personal'
      and q.classification->>'courseId' = v_listing.quizz_id::text
      and q.status = 'published'
      and q.validated;
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
