alter table public.questions add column chapter text;

drop policy quizz_chapters_read_subscribed on public.quizz_chapters;
drop policy quizz_notions_read_subscribed on public.quizz_notions;

drop table public.quizz_notions;
drop table public.quizz_chapters;

-- The marketplace migration's `questions_read_accessible` and
-- `quizzes_read_subscribed` policies query quizz_listings/
-- quizz_listing_subscriptions directly in their USING clause, but those
-- tables have all direct grants revoked (everything else goes through
-- security-definer RPCs). A plain RLS policy's USING clause runs as the
-- querying role, so it can never see rows in a table it has no grant on —
-- this silently made both policies permission-denied for every query,
-- never caught before because nothing had exercised them against a real
-- Postgres instance. This helper runs as the (trusted) function owner so
-- the check succeeds regardless of the caller's own table grants.
create or replace function public.has_subscribed_quizz_access(p_quizz_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.quizz_listings l
    join public.quizz_listing_subscriptions s on s.listing_id = l.id
    where l.quizz_id = p_quizz_id and s.user_id = (select auth.uid())
  );
$$;
revoke all on function public.has_subscribed_quizz_access(uuid) from public, anon;
grant execute on function public.has_subscribed_quizz_access(uuid) to authenticated;

drop policy questions_read_accessible on public.questions;
create policy questions_read_accessible on public.questions for select using (
  owner_id = auth.uid() or source = 'static' or (
    source = 'shared' and status = 'published' and validated
    and public.is_latest_question_version(id, version)
  ) or (
    classification->>'kind' = 'personal'
    and public.has_subscribed_quizz_access((classification->>'courseId')::uuid)
  )
);

drop policy quizzes_read_subscribed on public.quizzes;
create policy quizzes_read_subscribed on public.quizzes for select using (
  public.has_subscribed_quizz_access(quizzes.id)
);

create or replace function public.is_valid_question_classification(p_classification jsonb, p_source text)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_owner uuid := auth.uid();
begin
  if p_classification->>'kind' = 'official' then
    return exists (
      select 1 from public.official_program_notions
      where part_id = p_classification->>'partId'
        and chapter_id = p_classification->>'chapterId'
        and notion_id = p_classification->>'notionId'
    );
  end if;
  if p_classification->>'kind' <> 'personal' or p_source = 'shared' then return false; end if;
  return exists (
    select 1 from public.quizzes c
    where c.id = (p_classification->>'courseId')::uuid and c.owner_id = v_owner
  );
exception when invalid_text_representation then return false;
end $$;

create or replace function public.import_chatgpt_question_drafts(
  p_oauth_client_id text,
  p_payload_hash text,
  p_payload jsonb,
  p_accepted_indices jsonb,
  p_quarantined jsonb,
  p_warnings jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_import public.question_imports%rowtype;
  v_entry jsonb;
  v_index integer := 0;
  v_position integer := 0;
  v_course uuid;
  v_classification jsonb;
  v_correction jsonb;
  v_accepted jsonb := '[]'::jsonb;
  v_quarantined jsonb := coalesce(p_quarantined, '[]'::jsonb);
  v_report jsonb;
begin
  if v_owner is null then raise exception 'authentication-required'; end if;
  if nullif(auth.jwt()->>'client_id','') is null then raise exception 'oauth-client-missing'; end if;
  if auth.jwt()->>'client_id' <> p_oauth_client_id then raise exception 'oauth-client-mismatch'; end if;
  if not public.is_allowed_oauth_integration_client(p_oauth_client_id, 'chatgpt-question-import') then raise exception 'oauth-client-not-allowed'; end if;
  if nullif(p_oauth_client_id,'') is null or p_payload_hash is null then raise exception 'invalid-import-authority'; end if;

  insert into public.question_imports(owner_id, oauth_client_id, import_id, payload_hash, report, coverage)
  values (v_owner, p_oauth_client_id, p_payload->>'importId', p_payload_hash, '{}'::jsonb, p_payload->>'analysisCoverage')
  on conflict (owner_id, oauth_client_id, import_id) do nothing
  returning * into v_import;

  if v_import.id is null then
    select * into v_import from public.question_imports
    where owner_id = v_owner and oauth_client_id = p_oauth_client_id and import_id = p_payload->>'importId';
    if v_import.payload_hash <> p_payload_hash then
      return jsonb_build_object('kind', 'conflict');
    end if;
    return jsonb_build_object('kind', 'replay', 'report', v_import.report || jsonb_build_object('replayed', true));
  end if;

  for v_entry in select value from jsonb_array_elements(p_payload->'questions') loop
    v_index := (p_accepted_indices->>v_position)::integer;
    v_course := null; v_classification := null;
    if v_entry#>>'{classification,kind}' = 'official' then
      select jsonb_build_object('kind','official','partId',part_id,'chapterId',chapter_id,'notionId',notion_id)
      into v_classification from public.official_program_notions
      where notion_id = v_entry#>>'{classification,notionId}' and chapter_id = v_entry#>>'{classification,chapterId}';
      if v_classification is null then
        v_quarantined := v_quarantined || jsonb_build_object('index',v_index,'code','classification-unresolved','path','questions['||v_index||'].classification','message','Classification officielle non résolue.');
        v_position := v_position + 1;
        continue;
      end if;
    else
      select id into v_course from public.quizzes where owner_id=v_owner and title=v_entry#>>'{classification,proposedCourseTitle}' order by created_at limit 1;
      if v_course is null then insert into public.quizzes(owner_id,title) values(v_owner,v_entry#>>'{classification,proposedCourseTitle}') returning id into v_course; end if;
      v_classification := jsonb_build_object('kind','personal','courseId',v_course,'chapter',nullif(v_entry#>>'{classification,proposedChapterTitle}',''));
    end if;
    select jsonb_agg(jsonb_build_object('id','step-'||ordinality,'title',value->'title','content',value->'content') order by ordinality)
      into v_correction from jsonb_array_elements(v_entry->'correction') with ordinality;
    insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,parameterization,tags,provenance)
    values(gen_random_uuid(),1,v_owner,'private','draft',false,v_classification,v_entry->>'type',nullif(v_entry->>'difficulty','')::text,
      jsonb_build_object('prompt',v_entry->'prompt','hint',v_entry->'hint','correction',v_correction),v_entry->'parameterization',v_entry->'tags',
      jsonb_build_object('bundleId',p_payload->>'importId','importedAt',now(),'references',jsonb_build_array(jsonb_build_object('sourceLabel','ChatGPT course import','sourceReference',coalesce(v_entry->>'clientEntryId',v_index::text),'sourceLocator',null)),'chatGptImport',jsonb_build_object('coverage',p_payload->>'analysisCoverage','entryIndex',v_index,'clientEntryId',v_entry->'clientEntryId','uncertainties',v_entry->'uncertainties')));
    v_accepted := v_accepted || to_jsonb(v_index);
    v_position := v_position + 1;
  end loop;
  v_report := jsonb_build_object('schemaVersion',1,'importId',p_payload->>'importId','accepted',v_accepted,'quarantined',v_quarantined,'warnings',coalesce(p_warnings,'[]'::jsonb),'replayed',false);
  update public.question_imports set report=v_report where id=v_import.id;
  insert into public.question_import_quarantine(owner_id,import_row_id,entry_index,code,path,message)
  select v_owner,v_import.id,(q->>'index')::integer,q->>'code',left(q->>'path',500),left(q->>'message',1000) from jsonb_array_elements(v_quarantined) q;
  return jsonb_build_object('kind','created','report',v_report);
end $$;

comment on column public.questions.chapter is 'Flat, free-text chapter tag for personal/quizz questions. Not used by official questions, which keep the classification-embedded partId/chapterId/notionId program hierarchy.';
