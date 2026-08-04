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
});
