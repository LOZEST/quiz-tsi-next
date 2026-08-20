-- Lets a subscriber remove their own subscription to a quizz listing (the
-- "ajouter/retirer" counterpart to subscribe_to_quizz_listing). Idempotent
-- like the insert it undoes: unsubscribing twice, or from a listing you were
-- never subscribed to, is a silent no-op rather than an error — deleting a
-- row that isn't there is not a failure condition worth surfacing.
create or replace function public.unsubscribe_from_quizz_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.quizz_listing_subscriptions
  where listing_id = p_listing_id and user_id = (select auth.uid());
end;
$$;

revoke all on function public.unsubscribe_from_quizz_listing(uuid) from public, anon;
grant execute on function public.unsubscribe_from_quizz_listing(uuid) to authenticated;
