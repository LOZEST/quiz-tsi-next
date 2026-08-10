create table public.personal_courses (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.personal_chapters (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.personal_courses(id) on delete cascade, title text not null check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.personal_notions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.personal_courses(id) on delete cascade, chapter_id uuid references public.personal_chapters(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
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
