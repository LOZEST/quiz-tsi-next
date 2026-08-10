begin;
select plan(32);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@example.test','',now(),now()),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@example.test','',now(),now()),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@example.test','',now(),now());
update public.profiles set role='admin' where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.profiles set role='owner' where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
insert into public.oauth_integration_clients(client_id,purpose) values('gpt-fixture','chatgpt-question-import');

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
select lives_ok($$insert into public.personal_courses(id,owner_id,title) values('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Cours A')$$,'A écrit son cours');
select lives_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values('aaaaaaaa-0000-4000-8000-000000000010',1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','private','draft',false,'{"kind":"personal","courseId":"aaaaaaaa-0000-4000-8000-000000000001","chapterId":null,"notionId":null}','course','standard','{"prompt":[{"kind":"text","value":"A"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'A écrit private A');
select is((select count(*)::integer from public.questions where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1,'A lit private A');

select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
select is((select count(*)::integer from public.questions where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'B ne lit pas private A');
select throws_ok($$update public.questions set status='archived' where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,'42501',null,'B ne modifie pas A');
select throws_ok($$delete from public.questions where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,'42501',null,'B ne supprime pas A');
select throws_ok($$insert into public.personal_chapters(owner_id,course_id,title) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-0000-4000-8000-000000000001','Intrus')$$,'23503',null,'B ne référence pas le cours A');
select lives_ok($$insert into public.personal_courses(id,owner_id,title) values('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Cours B')$$,'B écrit son cours');
select throws_ok($$insert into public.personal_notions(owner_id,course_id,chapter_id,title) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','Intruse')$$,'23503',null,'B ne référence pas le chapitre A');
select is((select count(*)::integer from public.question_imports where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'B ne lit pas les imports A');
select is((select count(*)::integer from public.question_import_quarantine where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'B ne lit pas la quarantaine A');
select is((select count(*)::integer from public.personal_courses where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'B ne lit pas la taxonomie A');
select throws_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,null,'static','published',true,'{}','course','standard','{}','[]')$$,'42501',null,'static non mutable par utilisateur');
select throws_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','shared','published',true,'{"kind":"official","partId":"numbers","chapterId":"numbers-arithmetic","notionId":"NUM-F01"}','course','standard','{"prompt":[{"kind":"text","value":"B"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'42501',null,'user ne publie pas shared');
select throws_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','private','draft',false,'{"kind":"official","partId":"numbers","chapterId":"numbers-arithmetic","notionId":"FAUX"}','course','standard','{"prompt":[{"kind":"text","value":"B"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'42501',null,'faux identifiant officiel refusé');
select throws_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','private','draft',false,'{"kind":"personal","courseId":"aaaaaaaa-0000-4000-8000-000000000001","chapterId":null,"notionId":null}','course','standard','{"prompt":[{"kind":"text","value":"B"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'42501',null,'classification personnelle cross-account refusée');

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
insert into public.personal_chapters(id,owner_id,course_id,title) values('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','Chapitre A');
select lives_ok($$insert into public.personal_notions(owner_id,course_id,chapter_id,title) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','Notion A')$$,'A référence sa taxonomie');
select throws_ok($$update public.questions set status='archived' where id='aaaaaaaa-0000-4000-8000-000000000010'$$,'42501',null,'A ne modifie pas v1 en place');
select throws_ok($$delete from public.questions where id='aaaaaaaa-0000-4000-8000-000000000010'$$,'42501',null,'A ne supprime pas v1');
select throws_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shared','published',true,'{"kind":"personal","courseId":"aaaaaaaa-0000-4000-8000-000000000001","chapterId":"aaaaaaaa-0000-4000-8000-000000000002","notionId":null}','course','standard','{"prompt":[{"kind":"text","value":"A"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'42501',null,'shared personal refusé');
select lives_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values('aaaaaaaa-0000-4000-8000-000000000010',2,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shared','published',true,'{"kind":"official","partId":"numbers","chapterId":"numbers-arithmetic","notionId":"NUM-F01"}','course','standard','{"prompt":[{"kind":"text","value":"A v2"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'admin crée shared official valide');
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
select throws_ok($$select * from public.oauth_integration_clients$$,'42501',null,'allowlist privée inaccessible');
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
select lives_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values('aaaaaaaa-0000-4000-8000-000000000010',3,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shared','archived',true,'{"kind":"official","partId":"numbers","chapterId":"numbers-arithmetic","notionId":"NUM-F01"}','course','standard','{"prompt":[{"kind":"text","value":"A v3"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'admin archive par nouvelle version');
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
select is((select count(*)::integer from public.latest_accessible_questions where id='aaaaaaaa-0000-4000-8000-000000000010'),0,'latest archived ne révèle pas ancienne shared published');
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}',true);
select lives_ok($$insert into public.questions(id,version,owner_id,source,status,validated,classification,type,difficulty,content,tags) values(gen_random_uuid(),1,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','shared','published',true,'{"kind":"official","partId":"numbers","chapterId":"numbers-arithmetic","notionId":"NUM-F02"}','course','standard','{"prompt":[{"kind":"text","value":"C"}],"hint":[],"correction":[{"id":"s","title":null,"content":[{"kind":"text","value":"C"}]}]}','[]')$$,'owner crée shared official valide');
select * from finish();
rollback;
