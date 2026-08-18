-- Lets a user delete their own quizz. Soft delete (a `deleted_at` marker
-- rather than a real row deletion) so it round-trips through the existing
-- saveQuizz/push('update') sync path unchanged — no new outbox operation
-- kind, no new RPC. The client filters deleted_at is not null out of
-- QuestionWorkspaceRepository.load()'s `quizzes` list everywhere it's read.
alter table public.quizzes
  add column deleted_at timestamptz;
