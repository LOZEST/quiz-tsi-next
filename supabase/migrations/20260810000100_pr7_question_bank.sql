create table public.personal_courses (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.personal_courses add constraint personal_courses_id_owner_unique unique (id, owner_id);
create table public.personal_chapters (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.personal_courses(id) on delete cascade, title text not null check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.personal_chapters add constraint personal_chapters_id_course_owner_unique unique (id, course_id, owner_id);
alter table public.personal_chapters add constraint personal_chapters_course_owner_fk foreign key (course_id, owner_id) references public.personal_courses(id, owner_id) on delete cascade;
create table public.personal_notions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.personal_courses(id) on delete cascade, chapter_id uuid references public.personal_chapters(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.personal_notions add constraint personal_notions_course_owner_fk foreign key (course_id, owner_id) references public.personal_courses(id, owner_id) on delete cascade;
alter table public.personal_notions add constraint personal_notions_chapter_course_owner_fk foreign key (chapter_id, course_id, owner_id) references public.personal_chapters(id, course_id, owner_id) on delete cascade;
create table public.questions (
  id uuid not null, version integer not null check (version > 0), owner_id uuid references auth.users(id) on delete cascade,
  source text not null check (source in ('static','private','shared')), status text not null check (status in ('draft','published','archived')),
  validated boolean not null default false, classification jsonb not null, type text not null check (type in ('formula','course','calculation','reflex')),
  difficulty text check (difficulty in ('fundamental','standard','trap')), content jsonb not null, parameterization jsonb, tags jsonb not null default '[]'::jsonb,
  provenance jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (id, version), check ((source = 'static' and owner_id is null) or (source in ('private','shared') and owner_id is not null)),
  check (status <> 'published' or validated), check ((type = 'reflex' and difficulty is null) or (type <> 'reflex' and difficulty is not null))
);
create table public.official_program_notions (
  notion_id text primary key, chapter_id text not null, part_id text not null,
  chapter_label text not null, notion_label text not null
);
insert into public.official_program_notions values
  ('NUM-F01','numbers-arithmetic','numbers','Nombres et arithmétique','Calcul d’une expression et classement dans les ensembles'),
  ('NUM-F02','numbers-arithmetic','numbers','Nombres et arithmétique','Divisibilité, parité, multiples et décomposition première'),
  ('NUM-F03','numbers-arithmetic','numbers','Nombres et arithmétique','Lois des puissances à base commune'),
  ('NUM-F04','numbers-arithmetic','numbers','Nombres et arithmétique','Simplification à puissances, racines et substitutions');
create table public.question_imports (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  oauth_client_id text not null, import_id text not null check (char_length(import_id) between 1 and 200), payload_hash text not null,
  report jsonb not null, coverage text not null check (coverage in ('text-and-visuals','text-only','incomplete')), created_at timestamptz not null default now(),
  unique(owner_id, oauth_client_id, import_id)
);
create table public.question_import_quarantine (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  import_row_id uuid not null references public.question_imports(id) on delete cascade, entry_index integer not null,
  code text not null, path text not null, message text not null, snapshot jsonb, created_at timestamptz not null default now()
);

alter table public.personal_courses enable row level security;
alter table public.personal_chapters enable row level security;
alter table public.personal_notions enable row level security;
alter table public.questions enable row level security;
alter table public.official_program_notions enable row level security;
alter table public.question_imports enable row level security;
alter table public.question_import_quarantine enable row level security;

create policy personal_courses_own on public.personal_courses for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy personal_chapters_own on public.personal_chapters for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy personal_notions_own on public.personal_notions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy questions_read_accessible on public.questions for select using (source = 'static' or source = 'shared' or owner_id = auth.uid());
create policy official_program_read on public.official_program_notions for select to authenticated using (true);
create policy questions_insert_own_private on public.questions for insert with check (owner_id = auth.uid() and source in ('private','shared'));
create policy questions_update_own on public.questions for update using (owner_id = auth.uid() and source <> 'static') with check (owner_id = auth.uid() and source in ('private','shared'));
create policy questions_delete_own on public.questions for delete using (owner_id = auth.uid() and source <> 'static');
create policy question_imports_own on public.question_imports for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy question_import_quarantine_own on public.question_import_quarantine for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create index questions_owner_updated_idx on public.questions(owner_id, updated_at desc);
create index personal_chapters_owner_course_idx on public.personal_chapters(owner_id, course_id);
create index personal_notions_owner_course_idx on public.personal_notions(owner_id, course_id);

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
  if coalesce(auth.jwt()->>'client_id','') <> p_oauth_client_id then raise exception 'oauth-client-mismatch'; end if;
  if p_oauth_client_id is null or p_payload_hash is null then raise exception 'invalid-import-authority'; end if;

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
        insert into public.personal_notions(owner_id,course_id,chapter_id,title) values(v_owner,v_course,v_chapter,v_entry#>>'{classification,proposedNotionTitle}') returning id into v_notion;
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
