-- Fix: get_quizz_listing_preview crashed the Marketplace detail view for any
-- quizz containing a question whose stored content.correction (or, defensively,
-- content.prompt) is JSON null rather than an empty array — real rows in
-- production have this shape (e.g. a draft saved with no correction steps
-- yet), and the frontend unconditionally calls .map() on both fields.
-- nullif(..., 'null'::jsonb) is needed in addition to coalesce because a
-- stored JSON null is a real jsonb value, not SQL NULL, so a plain coalesce
-- does not catch it.
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
