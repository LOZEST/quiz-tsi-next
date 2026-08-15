-- Revert 20260817000200_resolve_official_notion_by_id.sql.
--
-- That migration resolved an official classification by notion_id alone,
-- dropping the chapterId match entirely. The pgTAP suite
-- (supabase/tests/pr7_question_bank_rls.sql, cases "chapterId inconnu" and
-- "relation chapitre/notion incohérente") exists specifically to catch a
-- valid notionId paired with a wrong chapterId and quarantine it — the
-- exact shape of the production incident this was meant to fix. Silently
-- accepting that combination defeats the safeguard: it hides GPT
-- classification confusion instead of surfacing it for review.
--
-- The actual fix for the incident belongs in the GPT's own instructions
-- (chapterId must be read from the same Knowledge row as notionId, never
-- reused from the document's top-level chapter) — see
-- docs/integrations/chatgpt-import/GPT_INSTRUCTIONS.md. The RPC keeps
-- requiring an exact chapterId + notionId match, restored here verbatim
-- from 20260810000100_pr7_question_bank.sql.
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
  v_chapter uuid;
  v_notion uuid;
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
    v_course := null; v_chapter := null; v_notion := null; v_classification := null;
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
      select id into v_course from public.personal_courses where owner_id=v_owner and title=v_entry#>>'{classification,proposedCourseTitle}' order by created_at limit 1;
      if v_course is null then insert into public.personal_courses(owner_id,title) values(v_owner,v_entry#>>'{classification,proposedCourseTitle}') returning id into v_course; end if;
      if nullif(v_entry#>>'{classification,proposedChapterTitle}','') is not null then
        select id into v_chapter from public.personal_chapters where owner_id=v_owner and course_id=v_course and title=v_entry#>>'{classification,proposedChapterTitle}' order by created_at limit 1;
        if v_chapter is null then insert into public.personal_chapters(owner_id,course_id,title) values(v_owner,v_course,v_entry#>>'{classification,proposedChapterTitle}') returning id into v_chapter; end if;
      end if;
      if nullif(v_entry#>>'{classification,proposedNotionTitle}','') is not null then
        select id into v_notion from public.personal_notions
        where owner_id = v_owner
          and course_id = v_course
          and chapter_id is not distinct from v_chapter
          and title = v_entry#>>'{classification,proposedNotionTitle}'
        order by created_at limit 1;
        if v_notion is null then
          insert into public.personal_notions(owner_id,course_id,chapter_id,title)
          values(v_owner,v_course,v_chapter,v_entry#>>'{classification,proposedNotionTitle}')
          returning id into v_notion;
        end if;
      end if;
      v_classification := jsonb_build_object('kind','personal','courseId',v_course,'chapterId',v_chapter,'notionId',v_notion);
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

revoke all on function public.import_chatgpt_question_drafts(text, text, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.import_chatgpt_question_drafts(text, text, jsonb, jsonb, jsonb, jsonb) from anon;
grant execute on function public.import_chatgpt_question_drafts(text, text, jsonb, jsonb, jsonb, jsonb) to authenticated;
