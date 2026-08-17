import {
  createProgramIndex,
  validateProgram,
} from '../../../src/domain/program/Program';
import { InMemoryQuestionRepository } from '../../../src/infrastructure/questions/InMemoryQuestionRepository';
import {
  normalizeFreeRevisionFilters,
  deriveAvailableChapters,
  deriveAvailableNotions,
} from '../../../src/domain/session/FreeRevisionFilters';
import { validateQuestionBankBundle } from '../../../src/domain/questions/QuestionBank';
import { importQuestionBankBundle } from '../../../src/domain/questions/QuestionBankImporter';
import { QuestionBankIndex } from '../../../src/domain/questions/QuestionBankIndex';
import { prepareQuestion } from '../../../src/domain/questions/PreparedQuestion';
import { selectFreeRevisionQuestions } from '../../../src/domain/questions/QuestionSelection';
import type { Question } from '../../../src/domain/questions/Question';
import { MergedQuestionRepository } from '../../../src/infrastructure/session/MergedQuestionRepository';

const programValue = {
  schemaVersion: 1,
  parts: [
    { id: 'p1', label: 'Partie 1', order: 0 },
    { id: 'p2', label: 'Partie 2', order: 1 },
  ],
  chapters: [
    { id: 'c1', partId: 'p1', label: 'Chapitre 1', order: 0 },
    { id: 'c2', partId: 'p2', label: 'Chapitre 2', order: 0 },
  ],
  notions: [
    { id: 'n1', chapterId: 'c1', label: 'Notion 1', order: 0 },
    { id: 'n2', chapterId: 'c2', label: 'Notion 2', order: 0 },
  ],
};
const programResult = validateProgram(programValue);
if (!programResult.ok) throw new Error('fixture programme invalide');
const program = createProgramIndex(programResult.value);

const question = (id: string, overrides: Partial<Question> = {}): Question => ({
  id,
  version: 1,
  source: 'static',
  ownerId: null,
  status: 'published',
  provenance: null,
  partId: 'p1',
  chapterId: 'c1',
  notionId: 'n1',
  type: 'course',
  difficulty: 'standard',
  parameterization: null,
  prompt: [{ kind: 'text', value: `Question ${id}` }],
  hint: [],
  correction: [
    { id: 's1', title: null, content: [{ kind: 'text', value: 'Correction' }] },
  ],
  tags: ['fixture'],
  validated: true,
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
  ...overrides,
});
const bundle = (questions: Question[]) => ({
  schemaVersion: 1,
  bundleId: 'fixture-bank',
  generatedAt: '2026-08-04T00:00:00.000Z',
  defaultProvenance: [
    {
      sourceLabel: 'Fixture originale',
      sourceReference: null,
      sourceLocator: 'tests',
    },
  ],
  questions: questions.map((entry) => ({ question: entry, provenance: null })),
});
const allFilters = {
  part: { kind: 'all' as const },
  chapter: { kind: 'all' as const },
  notion: { kind: 'all' as const },
  questionType: { kind: 'all' as const },
  difficulty: { kind: 'all' as const },
};
const parameterizedQuestion = (): Question =>
  question('parameterized', {
    parameterization: {
      schemaVersion: 1,
      variables: [
        {
          id: 'x',
          label: 'x',
          domain: { kind: 'choice', values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        },
      ],
      constraints: [],
      validationVariantCount: 10,
    },
    prompt: [{ kind: 'text', value: 'Valeur @x' }],
  });

describe('QuestionBankBundle', () => {
  it('normalise une copie profondément immuable sans modifier la source', () => {
    const source = bundle([question('q1')]);
    const result = validateQuestionBankBundle(source, program);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toBe(source);
    expect(Object.isFrozen(result.value.questions[0]?.question.prompt)).toBe(
      true,
    );
    expect(source.questions[0]?.question.provenance).toBeNull();
    expect(result.value.questions[0]?.question.provenance?.bundleId).toBe(
      'fixture-bank',
    );
  });

  it.each([
    [{ ...bundle([]), schemaVersion: 9 }, 'schemaVersion'],
    [{ ...bundle([]), bundleId: ' ' }, 'bundleId'],
    [{ ...bundle([]), generatedAt: 'hier' }, 'generatedAt'],
    [{ ...bundle([]), questions: null }, 'questions'],
  ])('refuse une enveloppe invalide', (value, path) => {
    const result = validateQuestionBankBundle(value, program);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues.some((entry) => entry.path === path)).toBe(true);
  });

  it('refuse doublons et incohérences de programme', () => {
    const duplicate = validateQuestionBankBundle(
      bundle([question('q1'), question('q1')]),
      program,
    );
    expect(duplicate.ok).toBe(false);
    const mismatch = validateQuestionBankBundle(
      bundle([question('q2', { chapterId: 'c2' })]),
      program,
    );
    expect(mismatch.ok).toBe(false);
  });

  it('capture getters, Proxy et cycles', () => {
    const hostile = Object.defineProperty({}, 'schemaVersion', {
      get: () => {
        throw new Error('boom');
      },
    });
    expect(validateQuestionBankBundle(hostile).ok).toBe(false);
    expect(
      validateQuestionBankBundle(
        new Proxy(
          {},
          {
            ownKeys: () => {
              throw new Error('boom');
            },
          },
        ),
      ).ok,
    ).toBe(false);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(validateQuestionBankBundle(cyclic).ok).toBe(false);
  });
});

describe('import et repository', () => {
  it.each([
    ['même id/version', [question('duplicate'), question('duplicate')]],
    [
      'même id avec versions différentes',
      [question('duplicate'), question('duplicate', { version: 2 })],
    ],
    [
      'trois occurrences',
      [
        question('duplicate'),
        question('duplicate', { version: 2 }),
        question('duplicate', { version: 3 }),
      ],
    ],
    [
      'doublons non adjacents',
      [
        question('duplicate'),
        question('other'),
        question('duplicate', { version: 2 }),
      ],
    ],
  ])('rejette un bundle ambigu : %s', (_label, questions) => {
    const result = importQuestionBankBundle(bundle(questions), [], program);
    expect(result.kind).toBe('rejected');
    expect(result.report.diagnostics.join(' ')).toContain(
      'questions.0.question.id',
    );
    expect(result.report.diagnostics.join(' ')).toContain(
      `questions.${questions.length - 1}.question.id`,
    );
  });

  it('met en quarantaine les seules entrées hostiles', () => {
    const getter = Object.defineProperty({}, 'question', {
      enumerable: true,
      get: () => {
        throw new Error('hostile');
      },
    });
    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('hostile');
        },
      },
    );
    const source = bundle([question('valid-1'), question('valid-2')]);
    const mixed = {
      ...source,
      questions: [source.questions[0], getter, source.questions[1], proxy],
    };
    const result = importQuestionBankBundle(mixed, [], program);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.report.entries.map((entry) => entry.status)).toEqual([
      'accepted',
      'quarantined',
      'accepted',
      'quarantined',
    ]);
    expect(result.quarantine.map((entry) => entry.entryIndex)).toEqual([1, 3]);
    expect(result.bundle.questions.map((entry) => entry.question.id)).toEqual([
      'valid-1',
      'valid-2',
    ]);
  });
  it('importe, ignore le second passage et met un conflit en quarantaine', () => {
    const first = importQuestionBankBundle(
      bundle([question('q1')]),
      [],
      program,
    );
    expect(first.kind).toBe('ready');
    if (first.kind !== 'ready') return;
    expect(first.report.totalAccepted).toBe(1);
    const second = importQuestionBankBundle(
      bundle([question('q1')]),
      first.bundle.questions.map((entry) => entry.question),
      program,
    );
    expect(second.kind).toBe('ready');
    if (second.kind !== 'ready') return;
    expect(second.report.totalIgnored).toBe(1);
    const conflict = importQuestionBankBundle(
      bundle([
        question('q1', { prompt: [{ kind: 'text', value: 'Différent' }] }),
      ]),
      first.bundle.questions.map((entry) => entry.question),
      program,
    );
    expect(conflict.kind).toBe('ready');
    if (conflict.kind === 'ready')
      expect(conflict.report.entries[0]?.status).toBe('quarantined');
  });

  it('applique les règles de version', () => {
    const initial = importQuestionBankBundle(
      bundle([question('q1', { version: 2 })]),
      [],
      program,
    );
    expect(initial.kind).toBe('ready');
    if (initial.kind !== 'ready') return;
    const current = initial.bundle.questions[0]?.question as Question;
    const older = importQuestionBankBundle(
      bundle([question('q1')]),
      [current],
      program,
    );
    expect(older.kind === 'ready' && older.report.entries[0]?.status).toBe(
      'rejected',
    );
    const newer = importQuestionBankBundle(
      bundle([question('q1', { version: 3 })]),
      [current],
      program,
    );
    expect(newer.kind === 'ready' && newer.report.entries[0]?.status).toBe(
      'updated',
    );
  });

  it('conserve un état atomique, ordonné et non exposé', () => {
    const validated = validateQuestionBankBundle(
      bundle([question('z'), question('a')]),
      program,
    );
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const repository = new InMemoryQuestionRepository(validated.value);
    expect(repository.listPublished().map((entry) => entry.id)).toEqual([
      'a',
      'z',
    ]);
    expect(repository.getLatestById('a')).not.toBe(
      validated.value.questions[1]?.question,
    );
    expect(Object.isFrozen(repository.listPublished())).toBe(true);
    expect(repository.getByIdAndVersion('a', 1)?.id).toBe('a');
    expect(repository.getBankMetadata()?.questionCount).toBe(2);
    const before = repository.listPublished();
    const rejected = repository.importAndReplace(null, program);
    expect(rejected.kind).toBe('rejected');
    expect(repository.listPublished()).toEqual(before);
  });

  it('laisse le repository intact après rejet de doublons', () => {
    const initial = validateQuestionBankBundle(
      bundle([question('installed')]),
      program,
    );
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const repository = new InMemoryQuestionRepository(initial.value);
    const before = repository.listPublished();
    const result = repository.importAndReplace(
      bundle([question('duplicate'), question('duplicate', { version: 2 })]),
      program,
    );
    expect(result.kind).toBe('rejected');
    expect(repository.listPublished()).toEqual(before);
  });

  it('laisse le repository intact après une erreur de validation finale', () => {
    const initial = validateQuestionBankBundle(
      bundle([question('installed')]),
      program,
    );
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const repository = new InMemoryQuestionRepository(initial.value);
    const restrictedProgramResult = validateProgram({
      schemaVersion: 1,
      parts: [{ id: 'p2', label: 'Partie 2', order: 0 }],
      chapters: [{ id: 'c2', partId: 'p2', label: 'Chapitre 2', order: 0 }],
      notions: [{ id: 'n2', chapterId: 'c2', label: 'Notion 2', order: 0 }],
    });
    expect(restrictedProgramResult.ok).toBe(true);
    if (!restrictedProgramResult.ok) return;
    const before = repository.listPublished();
    const result = repository.importAndReplace(
      bundle([
        question('incoming', { partId: 'p2', chapterId: 'c2', notionId: 'n2' }),
      ]),
      createProgramIndex(restrictedProgramResult.value),
    );
    expect(result.kind).toBe('rejected');
    expect(repository.listPublished()).toEqual(before);
  });

  it('rapporte ensemble accepted, rejected et quarantined', () => {
    const initial = importQuestionBankBundle(
      bundle([question('existing', { version: 2 })]),
      [],
      program,
    );
    expect(initial.kind).toBe('ready');
    if (initial.kind !== 'ready') return;
    const invalid = question('invalid', { validated: false });
    const result = importQuestionBankBundle(
      bundle([question('accepted'), question('existing'), invalid]),
      initial.bundle.questions.map((entry) => entry.question),
      program,
    );
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.report.entries.map((entry) => entry.status)).toEqual([
      'accepted',
      'rejected',
      'quarantined',
    ]);
    expect(Object.isFrozen(result.report.entries)).toBe(true);
    expect(Object.isFrozen(result.quarantine)).toBe(true);
  });

  it('couvre query sans exposer les structures internes', () => {
    const validated = validateQuestionBankBundle(
      bundle([
        question('p1'),
        question('p2', { partId: 'p2', chapterId: 'c2', notionId: 'n2' }),
      ]),
      program,
    );
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const repository = new InMemoryQuestionRepository(validated.value);
    const result = repository.query({ partId: 'p2', source: 'static' });
    expect(result.map((entry) => entry.id)).toEqual(['p2']);
    expect(Object.isFrozen(result[0]?.prompt)).toBe(true);
  });
});

describe('index, filtres et sélection', () => {
  it('filtre Réflexe avec difficulté non applicable', () => {
    const reflex = question('r', { type: 'reflex', difficulty: null });
    const index = new QuestionBankIndex([question('q'), reflex]);
    const result = index.query({ difficulty: 'not-applicable' });
    expect(result.ok && result.questions.map((entry) => entry.id)).toEqual([
      'r',
    ]);
    expect(index.query({ difficulty: 'standard' }).ok).toBe(true);
    expect(index.query({ type: 'inconnu' }).ok).toBe(false);
  });

  it('copie les questions avant de figer et reste indépendant de la source', () => {
    const source = question('mutable');
    const index = new QuestionBankIndex([source]);
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(source.prompt)).toBe(false);
    (source.prompt as Array<{ kind: 'text'; value: string }>)[0]!.value =
      'Mutation';
    const result = index.query({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions[0]?.prompt[0]).toEqual({
      kind: 'text',
      value: 'Question mutable',
    });
    expect(Object.isFrozen(result.questions[0]?.prompt)).toBe(true);
  });

  it.each([
    new Date(),
    new (class Filter {})(),
    Object.create({ type: 'course' }),
    Object.defineProperty({}, 'type', {
      get: () => 'course',
      enumerable: true,
    }),
    new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('hostile');
        },
      },
    ),
    { [Symbol('hostile')]: true },
    { unknown: true },
  ])('refuse un filtre hostile ou étranger', (filter) => {
    expect(new QuestionBankIndex([question('q')]).query(filter).ok).toBe(false);
  });

  it('accepte un filtre à prototype nul', () => {
    const filter = Object.assign(
      Object.create(null) as Record<string, unknown>,
      { type: 'course' },
    );
    expect(new QuestionBankIndex([question('q')]).query(filter).ok).toBe(true);
  });

  it('combine tous les axes de l’index et distingue all de not-applicable', () => {
    const reflex = question('reflex', { type: 'reflex', difficulty: null });
    const index = new QuestionBankIndex([question('course'), reflex]);
    const combined = index.query({
      partId: 'p1',
      chapterId: 'c1',
      notionId: 'n1',
      type: 'course',
      difficulty: 'standard',
      source: 'static',
      status: 'published',
    });
    expect(combined.ok && combined.questions.map((entry) => entry.id)).toEqual([
      'course',
    ]);
    const all = index.query({ difficulty: 'all' });
    const notApplicable = index.query({ difficulty: 'not-applicable' });
    expect(all.ok && all.questions).toHaveLength(2);
    expect(
      notApplicable.ok && notApplicable.questions.map((entry) => entry.id),
    ).toEqual(['reflex']);
  });

  it('traite un quizz personnel comme un chapitre via courseId', () => {
    const personal = question('quizz-question', {
      source: 'private',
      ownerId: 'owner-1',
      classification: {
        kind: 'personal',
        courseId: 'quizz-1',
        chapterId: null,
        notionId: null,
      },
    });
    const index = new QuestionBankIndex([question('official'), personal]);
    const byQuizz = index.query({ chapterId: 'quizz-1' });
    expect(byQuizz.ok && byQuizz.questions.map((entry) => entry.id)).toEqual([
      'quizz-question',
    ]);
    const byOfficialChapter = index.query({ chapterId: 'c1' });
    expect(
      byOfficialChapter.ok &&
        byOfficialChapter.questions.map((entry) => entry.id),
    ).toEqual(['official']);
  });

  it('dérive les listes et retire les enfants incompatibles', () => {
    expect(deriveAvailableChapters(program, { kind: 'all' })).toHaveLength(2);
    expect(
      deriveAvailableNotions(
        program,
        { kind: 'one', value: 'p1' },
        { kind: 'all' },
      ).map((entry) => entry.id),
    ).toEqual(['n1']);
    const normalized = normalizeFreeRevisionFilters(
      {
        ...allFilters,
        part: { kind: 'one', value: 'p2' },
        chapter: { kind: 'one', value: 'c1' },
        notion: { kind: 'one', value: 'n1' },
      },
      program,
    );
    expect(normalized.ok && normalized.value.chapter).toEqual({ kind: 'all' });
    expect(normalized.ok && normalized.value.notion).toEqual({ kind: 'all' });
  });

  it('MergedQuestionRepository fusionne le pool officiel et les contributions perso', () => {
    const validated = validateQuestionBankBundle(
      bundle([question('official')]),
      program,
    );
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const staticRepository = new InMemoryQuestionRepository(validated.value);
    const merged = new MergedQuestionRepository(staticRepository);
    const personal = question('quizz-question', {
      source: 'private',
      ownerId: 'owner-1',
      classification: {
        kind: 'personal',
        courseId: 'quizz-1',
        chapterId: null,
        notionId: null,
      },
    });
    expect(merged.listPublished().map((entry) => entry.id)).toEqual([
      'official',
    ]);
    merged.setUserContributions([personal]);
    expect(
      merged
        .listPublished()
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(['official', 'quizz-question']);
    expect(
      merged.query({ chapterId: 'quizz-1' }).map((entry) => entry.id),
    ).toEqual(['quizz-question']);
    expect(merged.getByIdAndVersion('quizz-question', 1)?.id).toBe(
      'quizz-question',
    );
    expect(merged.getLatestById('quizz-question')?.id).toBe('quizz-question');
    expect(merged.getBankMetadata()?.questionCount).toBe(1);
  });

  it('sélectionne et prépare dans un ordre déterministe', () => {
    const validated = validateQuestionBankBundle(
      bundle(['a', 'b', 'c', 'd'].map((id) => question(id))),
      program,
    );
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const repository = new InMemoryQuestionRepository(validated.value);
    const first = selectFreeRevisionQuestions(
      repository,
      allFilters,
      'seed',
      3,
    );
    const second = selectFreeRevisionQuestions(
      repository,
      allFilters,
      'seed',
      3,
    );
    expect(first).toEqual(second);
    expect(
      first.kind === 'ready' &&
        new Set(first.items.map((entry) => entry.questionId)).size,
    ).toBe(3);
    expect(
      selectFreeRevisionQuestions(
        new InMemoryQuestionRepository(),
        allFilters,
        'seed',
        1,
      ).kind,
    ).toBe('no-bank');
    expect(
      selectFreeRevisionQuestions(repository, allFilters, 'seed', 10).kind,
    ).toBe('insufficient-stock');
  });

  it('applique exclusions, no-match et ne modifie pas les filtres', () => {
    const validated = validateQuestionBankBundle(
      bundle([question('a'), question('b')]),
      program,
    );
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const repository = new InMemoryQuestionRepository(validated.value);
    const filters = structuredClone(allFilters);
    const selected = selectFreeRevisionQuestions(
      repository,
      filters,
      'seed',
      1,
      ['a'],
    );
    expect(selected.kind === 'ready' && selected.items[0]?.questionId).toBe(
      'b',
    );
    expect(filters).toEqual(allFilters);
    expect(
      selectFreeRevisionQuestions(repository, filters, 'seed', 1, ['a', 'b'])
        .kind,
    ).toBe('no-match');
    const unmatched = {
      ...filters,
      part: { kind: 'one' as const, value: 'p2' },
    };
    expect(
      selectFreeRevisionQuestions(repository, unmatched, 'seed', 1).kind,
    ).toBe('no-match');
  });
});

describe('préparation', () => {
  it('prépare une question statique sans créer de QuestionInstance', () => {
    const prepared = prepareQuestion(question('q1'), 'session', 0);
    expect(prepared.kind).toBe('ready');
    if (prepared.kind !== 'ready') return;
    expect(prepared.value.parameterValues).toEqual({});
    expect(prepared.value.content.questionId).toBe('q1');
    expect(Object.isFrozen(prepared.value)).toBe(true);
  });

  it('prépare une question paramétrée de façon reproductible', () => {
    const source = parameterizedQuestion();
    const first = prepareQuestion(source, 'session-a', 0);
    const repeated = prepareQuestion(source, 'session-a', 0);
    const other = prepareQuestion(source, 'session-b', 0);
    expect(first).toEqual(repeated);
    expect(first.kind).toBe('ready');
    expect(other.kind).toBe('ready');
    if (first.kind !== 'ready' || other.kind !== 'ready') return;
    expect(first.value.seed).not.toBe(other.value.seed);
    expect(first.value.parameterValues).not.toEqual(
      other.value.parameterValues,
    );
    expect(first.value.content.prompt[0]).toEqual({
      kind: 'text',
      value: `Valeur ${String(first.value.parameterValues.x)}`,
    });
    expect(Object.isFrozen(first.value.content.prompt)).toBe(true);
    expect(Object.isFrozen(source)).toBe(false);
    expect(source.prompt[0]).toEqual({ kind: 'text', value: 'Valeur @x' });
  });
});
