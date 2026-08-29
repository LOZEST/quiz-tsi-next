begin;
select plan(59);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@example.test','',now(),now()),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@example.test','',now(),now()),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@example.test','',now(),now());
update public.profiles set role='admin' where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.profiles set role='owner' where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
insert into public.oauth_integration_clients(client_id,purpose) values('gpt-fixture','chatgpt-question-import');

create function pg_temp.personal_import_entry(p_client text, p_course text, p_chapter text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'clientEntryId', p_client,
    'classification', jsonb_build_object(
      'kind','personal','proposedCourseTitle',p_course,
      'proposedChapterTitle',p_chapter,
      'reason','Hors programme','requiresUserConfirmation',true
    ),
    'type','course','difficulty','standard','parameterization',null,
    'prompt',jsonb_build_array(jsonb_build_object('kind','text','value','Question '||p_client)),
    'hint','[]'::jsonb,
    'correction',jsonb_build_array(jsonb_build_object('title',null,'content',jsonb_build_array(jsonb_build_object('kind','text','value','Réponse')))),
    'tags','[]'::jsonb,'uncertainties','[]'::jsonb
  );
$$;
create temporary table import_dedup_fixture(payload jsonb);
insert into import_dedup_fixture values (jsonb_build_object(
  'schemaVersion',1,'importId','dedup-fixture','analysisCoverage','text-only','confirmedByUser',true,
  'document',jsonb_build_object('kind','pdf','title','Fixture','pageCount',1),
  'questions',jsonb_build_array(
    pg_temp.personal_import_entry('a1','Cours A','Chapitre B'),
    pg_temp.personal_import_entry('a2','Cours A','Chapitre B'),
    pg_temp.personal_import_entry('b1','Cours A',null),
    pg_temp.personal_import_entry('b2','Cours A',null),
    pg_temp.personal_import_entry('c1','Cours A','Chapitre B'),
    pg_temp.personal_import_entry('c2','Cours A','Chapitre B'),
    pg_temp.personal_import_entry('d1','Cours A','Chapitre X'),
    pg_temp.personal_import_entry('d2','Cours A','Chapitre Y'),
    pg_temp.personal_import_entry('e1','Cours M',null),
    pg_temp.personal_import_entry('e2','Cours N',null)
  )
));
grant select on import_dedup_fixture to authenticated;

create temporary table import_case_fixture(payload jsonb);
insert into import_case_fixture values (jsonb_build_object(
  'schemaVersion',1,'importId','dedup-fixture-case','analysisCoverage','text-only','confirmedByUser',true,
  'document',jsonb_build_object('kind','pdf','title','Fixture','pageCount',1),
  'questions',jsonb_build_array(
    pg_temp.personal_import_entry('case1',' cours a ',null)
  )
));
grant select on import_case_fixture to authenticated;

create temporary table import_softdeleted_fixture(payload jsonb);
insert into import_softdeleted_fixture values (jsonb_build_object(
  'schemaVersion',1,'importId','dedup-fixture-after-delete','analysisCoverage','text-only','confirmedByUser',true,
  'document',jsonb_build_object('kind','pdf','title','Fixture','pageCount',1),
  'questions',jsonb_build_array(
    pg_temp.personal_import_entry('afterdelete1','Cours A',null)
  )
));
grant select on import_softdeleted_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
select lives_ok($$insert into public.quizzes(id,owner_id,title) values('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Cours A')$$,'A écrit son cours');
select is((select visibility from public.quizzes where id='aaaaaaaa-0000-4000-8000-000000000001'),'private','cours privé par défaut');
select lives_ok($$update public.quizzes set description='Une révision de maths',visibility='public' where id='aaaaaaaa-0000-4000-8000-000000000001'$$,'A modifie la description et la visibilité de son cours');
select lives_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values('aaaaaaaa-0000-4000-8000-000000000010',1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','private','draft',false,'{"kind":"personal","courseId":"aaaaaaaa-0000-4000-8000-000000000001","chapter":null}','course','standard','{"prompt":[{"kind":"text","value":"A"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'A écrit private A');
select is((select count(*)::integer from public.questions where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1,'A lit private A');

select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
select is((select count(*)::integer from public.questions where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'B ne lit pas private A');
select throws_ok($$update public.questions set status='archived' where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,'42501',null,'B ne modifie pas A');
select throws_ok($$delete from public.questions where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,'42501',null,'B ne supprime pas A');
update public.quizzes set description='Piraté',visibility='public' where id='aaaaaaaa-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.quizzes where id='aaaaaaaa-0000-4000-8000-000000000001' and description='Piraté'),0,'B ne modifie pas le cours de A');
select lives_ok($$insert into public.quizzes(id,owner_id,title) values('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Cours B')$$,'B écrit son cours');
select is((select count(*)::integer from public.question_imports where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'B ne lit pas les imports A');
select is((select count(*)::integer from public.question_import_quarantine where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'B ne lit pas la quarantaine A');
select is((select count(*)::integer from public.quizzes where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'B ne lit pas la taxonomie A');
select throws_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,null,'static','published',true,'{}','course','standard','{}','[]')$$,'42501',null,'static non mutable par utilisateur');
select throws_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','shared','published',true,'{"kind":"official","partId":"numbers","chapterId":"numbers-arithmetic","notionId":"NUM-F01"}','course','standard','{"prompt":[{"kind":"text","value":"B"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'42501',null,'user ne publie pas shared');
select throws_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','private','draft',false,'{"kind":"official","partId":"numbers","chapterId":"numbers-arithmetic","notionId":"FAUX"}','course','standard','{"prompt":[{"kind":"text","value":"B"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'42501',null,'faux identifiant officiel refusé');
select throws_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','private','draft',false,'{"kind":"personal","courseId":"aaaaaaaa-0000-4000-8000-000000000001","chapter":null}','course','standard','{"prompt":[{"kind":"text","value":"B"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'42501',null,'classification personnelle cross-account refusée');

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
select throws_ok($$update public.questions set status='archived' where id='aaaaaaaa-0000-4000-8000-000000000010'$$,'42501',null,'A ne modifie pas v1 en place');
select throws_ok($$delete from public.questions where id='aaaaaaaa-0000-4000-8000-000000000010'$$,'42501',null,'A ne supprime pas v1');
select throws_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shared','published',true,'{"kind":"personal","courseId":"aaaaaaaa-0000-4000-8000-000000000001","chapter":"Chapitre A"}','course','standard','{"prompt":[{"kind":"text","value":"A"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'42501',null,'shared personal refusé');
select lives_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values('aaaaaaaa-0000-4000-8000-000000000010',2,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shared','published',true,'{"kind":"official","partId":"fundamentals","chapterId":"numbers-arithmetic","notionId":"NUM-F01"}','course','standard','{"prompt":[{"kind":"text","value":"A v2"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'admin crée shared official valide');
select is((select count(*)::integer from public.latest_accessible_questions where id='aaaaaaaa-0000-4000-8000-000000000010' and version=2),1,'projection latest expose seulement v2');

select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
select is((select count(*)::integer from public.questions where source='shared'),1,'B lit shared A');
select throws_ok($$update public.questions set status='archived' where source='shared'$$,'42501',null,'B ne modifie pas shared A');
select has_function('public','import_chatgpt_question_drafts',array['text','text','jsonb','jsonb','jsonb','jsonb'],'RPC atomique présent');
select throws_ok($$select public.import_chatgpt_question_drafts('', 'hash-no-client', '{"importId":"no-client","analysisCoverage":"text-only","questions":[]}', '[]', '[]', '[]')$$,'P0001','oauth-client-missing','RPC refuse JWT sans client_id');
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","client_id":"other-client"}',true);
select throws_ok($$select public.import_chatgpt_question_drafts('other-client', 'hash-other', '{"importId":"other","analysisCoverage":"text-only","questions":[]}', '[]', '[]', '[]')$$,'P0001','oauth-client-not-allowed','RPC refuse client non allowlisté');
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","client_id":"gpt-fixture"}',true);
select lives_ok($$select public.import_chatgpt_question_drafts('gpt-fixture', 'hash-allowed', '{"importId":"allowed","analysisCoverage":"text-only","questions":[]}', '[]', '[]', '[]')$$,'RPC accepte client GPT allowlisté');
select is((select (public.import_chatgpt_question_drafts('gpt-fixture','hash-quarantine','{"importId":"only-quarantine","analysisCoverage":"text-only","questions":[]}','[]','[{"index":0,"code":"invalid-entry","path":"questions[0]","message":"Question invalide."}]','[]')->'report'->'accepted')::text),'[]','rapport sans entrée acceptée conservé');
select is((select jsonb_array_length(report->'quarantined') from public.question_imports where owner_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and import_id='only-quarantine'),1,'rapport de quarantaine persisté');
select throws_ok($$select * from public.oauth_integration_clients$$,'42501',null,'allowlist privée inaccessible');
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
select lives_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values('aaaaaaaa-0000-4000-8000-000000000010',3,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shared','archived',true,'{"kind":"official","partId":"fundamentals","chapterId":"numbers-arithmetic","notionId":"NUM-F01"}','course','standard','{"prompt":[{"kind":"text","value":"A v3"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'admin archive par nouvelle version');
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
select is((select count(*)::integer from public.latest_accessible_questions where id='aaaaaaaa-0000-4000-8000-000000000010'),0,'latest archived ne révèle pas ancienne shared published');
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}',true);
select lives_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','shared','published',true,'{"kind":"official","partId":"fundamentals","chapterId":"numbers-arithmetic","notionId":"NUM-F02"}','course','standard','{"prompt":[{"kind":"text","value":"C"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'owner crée shared official valide');
select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","client_id":"gpt-fixture"}',true);
select lives_ok($$select public.import_chatgpt_question_drafts('gpt-fixture','hash-dedup',(select payload from import_dedup_fixture),'[0,1,2,3,4,5,6,7,8,9]','[]','[]')$$,'import personnel groupé créé');
select is((select count(*)::integer from public.quizzes where owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),3,'trois cours distincts');
select is((select count(*)::integer from public.questions where owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and provenance->>'bundleId'='dedup-fixture'),10,'dix questions importées');
select is((select count(distinct (classification->>'courseId',classification->>'chapter'))::integer from public.questions where owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and provenance#>>'{chatGptImport,entryIndex}' in ('0','1')),1,'même cours et même chapitre partagent le même tag');
select is((select count(*)::integer from public.questions where owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and provenance#>>'{chatGptImport,entryIndex}' in ('2','3') and classification->>'chapter' is null),2,'deux questions conservent chapter null');
select is((select count(distinct classification->>'courseId')::integer from public.questions where owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and provenance#>>'{chatGptImport,entryIndex}' in ('8','9')),2,'même libellé sous deux cours conserve deux cours');
select lives_ok($$select public.import_chatgpt_question_drafts('gpt-fixture','hash-dedup',(select payload from import_dedup_fixture),'[0,1,2,3,4,5,6,7,8,9]','[]','[]')$$,'replay identique accepté');
select is((select jsonb_build_array((select count(*) from public.quizzes where owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),(select count(*) from public.questions where owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and provenance->>'bundleId'='dedup-fixture'))),'[3,10]'::jsonb,'replay ne crée aucune ligne');
select lives_ok($$select public.import_chatgpt_question_drafts('gpt-fixture','hash-case-insensitive',(select payload from import_case_fixture),'[0]','[]','[]')$$,'import avec titre différent en casse/espaces accepté');
select is((select count(*)::integer from public.quizzes where owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),3,'aucun quiz supplémentaire créé pour une variation de casse/espaces');
select is((select classification->>'courseId' from public.questions where owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and provenance->>'bundleId'='dedup-fixture-case'),(select id::text from public.quizzes where owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and title='Cours A'),'la question rejoint le quiz existant malgré la casse/espaces différents');
select lives_ok($$update public.quizzes set deleted_at=now() where owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and title='Cours A'$$,'le propriétaire supprime son quiz Cours A');
select lives_ok($$select public.import_chatgpt_question_drafts('gpt-fixture','hash-after-delete',(select payload from import_softdeleted_fixture),'[0]','[]','[]')$$,'import après suppression du quiz du même nom accepté');
select is((select count(*)::integer from public.quizzes where owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and title='Cours A'),2,'un nouveau quiz Cours A est créé, l’ancien supprimé n’est pas réutilisé');
-- Chemin "official" du RPC d'import GPT : régression du bug classification-unresolved
-- (public.official_program_notions désynchronisée de src/data/program/official-program-v2.json).
create function pg_temp.official_import_entry(p_client text, p_chapter text, p_notion text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'clientEntryId', p_client,
    'classification', jsonb_build_object('kind','official','chapterId',p_chapter,'notionId',p_notion,'confidence','certain'),
    'type','course','difficulty','standard','parameterization',null,
    'prompt',jsonb_build_array(jsonb_build_object('kind','text','value','Question '||p_client)),
    'hint','[]'::jsonb,
    'correction',jsonb_build_array(jsonb_build_object('title',null,'content',jsonb_build_array(jsonb_build_object('kind','text','value','Réponse')))),
    'tags','[]'::jsonb,'uncertainties','[]'::jsonb
  );
$$;
create temporary table official_import_fixture(name text, payload jsonb);
insert into official_import_fixture values
  ('valid', jsonb_build_object('schemaVersion',1,'importId','official-int-f02','analysisCoverage','text-only','confirmedByUser',true,'document',jsonb_build_object('kind','pdf','title','Fixture','pageCount',1),'questions',jsonb_build_array(pg_temp.official_import_entry('o1','primitives-integrals','INT-F02')))),
  ('bad-chapter', jsonb_build_object('schemaVersion',1,'importId','official-bad-chapter','analysisCoverage','text-only','confirmedByUser',true,'document',jsonb_build_object('kind','pdf','title','Fixture','pageCount',1),'questions',jsonb_build_array(pg_temp.official_import_entry('o2','INT','INT-F02')))),
  ('bad-notion', jsonb_build_object('schemaVersion',1,'importId','official-bad-notion','analysisCoverage','text-only','confirmedByUser',true,'document',jsonb_build_object('kind','pdf','title','Fixture','pageCount',1),'questions',jsonb_build_array(pg_temp.official_import_entry('o3','primitives-integrals','UNKNOWN')))),
  ('mismatch', jsonb_build_object('schemaVersion',1,'importId','official-mismatch','analysisCoverage','text-only','confirmedByUser',true,'document',jsonb_build_object('kind','pdf','title','Fixture','pageCount',1),'questions',jsonb_build_array(pg_temp.official_import_entry('o4','algebraic-calculus','INT-F02'))));
grant select on official_import_fixture to authenticated;

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","client_id":"gpt-fixture"}',true);

select lives_ok($$select public.import_chatgpt_question_drafts('gpt-fixture','hash-official-valid',(select payload from official_import_fixture where name='valid'),'[0]','[]','[]')$$,'RPC accepte une classification officielle synchronisée (INT-F02)');
select is((select (public.import_chatgpt_question_drafts('gpt-fixture','hash-official-valid',(select payload from official_import_fixture where name='valid'),'[0]','[]','[]')->'report'->>'replayed')::boolean),true,'retry du même importId officiel renvoie un replay');
select is((select count(*)::integer from public.questions where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and provenance#>>'{chatGptImport,clientEntryId}'='o1'),1,'le retry idempotent ne crée pas de doublon');
select is((select classification from public.questions where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and provenance#>>'{chatGptImport,clientEntryId}'='o1'),'{"kind":"official","partId":"functions-analysis","chapterId":"primitives-integrals","notionId":"INT-F02"}'::jsonb,'classification résolue avec partId/chapterId/notionId cohérents depuis la table synchronisée');

select is((select (public.import_chatgpt_question_drafts('gpt-fixture','hash-official-bad-chapter',(select payload from official_import_fixture where name='bad-chapter'),'[0]','[]','[]')->'report'->'quarantined'->0->>'code')),'classification-unresolved','chapterId inconnu ("INT") mis en quarantaine');
select is((select count(*)::integer from public.questions where provenance#>>'{chatGptImport,clientEntryId}'='o2'),0,'aucun brouillon créé pour un chapterId inconnu');

select is((select (public.import_chatgpt_question_drafts('gpt-fixture','hash-official-bad-notion',(select payload from official_import_fixture where name='bad-notion'),'[0]','[]','[]')->'report'->'quarantined'->0->>'code')),'classification-unresolved','notionId inconnu mis en quarantaine');
select is((select count(*)::integer from public.questions where provenance#>>'{chatGptImport,clientEntryId}'='o3'),0,'aucun brouillon créé pour un notionId inconnu');

select is((select (public.import_chatgpt_question_drafts('gpt-fixture','hash-official-mismatch',(select payload from official_import_fixture where name='mismatch'),'[0]','[]','[]')->'report'->'quarantined'->0->>'code')),'classification-unresolved','relation chapitre/notion incohérente mise en quarantaine');
select is((select count(*)::integer from public.questions where provenance#>>'{chatGptImport,clientEntryId}'='o4'),0,'aucun brouillon créé pour une relation chapitre/notion incohérente');

select throws_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','private','draft',false,'{"kind":"official","partId":"wrong-part","chapterId":"primitives-integrals","notionId":"INT-F02"}','course','standard','{"prompt":[{"kind":"text","value":"X"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'42501',null,'partId incohérent avec chapterId/notionId refusé');

select * from finish();
rollback;
