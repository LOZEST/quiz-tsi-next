import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  DIFFICULTIES,
  QUESTION_SOURCES,
  QUESTION_TYPES,
  SAFE_EXPRESSION_MAX_DEPTH,
  SAFE_EXPRESSION_MAX_LIST_ITEMS,
  SAFE_EXPRESSION_MAX_NODES,
  createQuestionInstance,
  validateContentSegment,
  validateQuestion,
  validateQuestionProvenance,
  validateQuestionSourceReference,
  validateSafeExpression,
  type ContentSegment,
  type Question,
} from '@domain/questions/Question';
import {
  SESSION_MODES,
  validateCalibrationEvidence,
  validateChapterTestPreparation,
  validateFreeRevisionFilters,
  type DailyPlanState,
  type WeakPointsState,
} from '@domain/session/Session';
import {
  PROGRAM_SCHEMA_VERSION,
  validateProgramChapter,
  validateProgramNotion,
  validateProgramPart,
} from '@domain/program/Program';
import {
  MATH_SYNTAX_VERSION,
  validateMathSource,
} from '@domain/math/MathSource';

const now = '2026-07-30T12:00:00.000Z';

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: 'question-1',
    version: 1,
    source: 'static',
    ownerId: null,
    status: 'published',
    provenance: null,
    partId: 'part-1',
    chapterId: 'chapter-1',
    notionId: 'notion-1',
    type: 'course',
    difficulty: 'fundamental',
    parameterization: null,
    prompt: [{ kind: 'text', value: 'Définir une suite.' }],
    hint: [],
    correction: [
      {
        id: 'step-1',
        title: null,
        content: [{ kind: 'text', value: 'Une définition.' }],
      },
    ],
    tags: [],
    validated: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('PR4 domain vocabularies', () => {
  it('exposes the exact normative values', () => {
    expect(QUESTION_TYPES).toEqual([
      'formula',
      'course',
      'calculation',
      'reflex',
    ]);
    expect(DIFFICULTIES).toEqual(['fundamental', 'standard', 'trap']);
    expect(QUESTION_SOURCES).toEqual(['static', 'private', 'shared']);
    expect(SESSION_MODES).toEqual([
      'daily',
      'weak-points',
      'free',
      'chapter-test',
    ]);
    expect(PROGRAM_SCHEMA_VERSION).toBe(1);
    expect(MATH_SYNTAX_VERSION).toBe(1);
  });
});

describe('program structures', () => {
  it('accepts nodes and rejects malformed structural values', () => {
    expect(validateProgramPart({ id: 'p', label: 'Partie', order: 0 }).ok).toBe(
      true,
    );
    expect(
      validateProgramChapter({
        id: 'c',
        partId: 'p',
        label: 'Chapitre',
        order: 0,
      }).ok,
    ).toBe(true);
    expect(
      validateProgramNotion({
        id: 'n',
        chapterId: 'c',
        label: 'Notion',
        order: 0,
      }).ok,
    ).toBe(true);
    expect(validateProgramPart({ id: '', label: 'Partie', order: -1 }).ok).toBe(
      false,
    );
    expect(
      validateProgramChapter({ id: 'c', label: 'Chapitre', order: 0 }).ok,
    ).toBe(false);
    expect(validateProgramPart(null).ok).toBe(false);
    expect(
      validateProgramNotion({ id: 'n', label: 'Notion', order: 0 }).ok,
    ).toBe(false);
  });
});

describe('content and questions', () => {
  it('validates MathSource and safe content segments', () => {
    const math = { syntaxVersion: 1, source: 'sqrt(x)' } as const;
    expect(validateMathSource(math)).toEqual({ ok: true, value: math });
    expect(validateContentSegment({ kind: 'inline-math', math }).ok).toBe(true);
    expect(validateContentSegment({ kind: 'line-break' }).ok).toBe(true);
    expect(validateMathSource({ syntaxVersion: 2, source: 'x' }).ok).toBe(
      false,
    );
    expect(validateContentSegment({ kind: 'html', value: '<b>x</b>' }).ok).toBe(
      false,
    );
    expect(validateContentSegment(null).ok).toBe(false);
    expectTypeOf<ContentSegment>().not.toBeAny();
  });

  it('applies Question invariants', () => {
    expect(validateQuestion(question()).ok).toBe(true);
    expect(
      validateQuestion(question({ status: 'published', validated: false })).ok,
    ).toBe(false);
    expect(
      validateQuestion(question({ source: 'private', ownerId: null })).ok,
    ).toBe(false);
    expect(
      validateQuestion(question({ source: 'shared', ownerId: 'author-1' })).ok,
    ).toBe(true);
    for (const ownerId of [
      42,
      { id: 'author-1' },
      ['author-1'],
      true,
      undefined,
    ]) {
      expect(
        validateQuestion({
          ...question(),
          source: 'shared',
          ownerId,
        }).ok,
      ).toBe(false);
    }
    expect(
      validateQuestion(
        question({
          parameterization: {
            schemaVersion: 1,
            variables: [],
            constraints: [],
            validationVariantCount: 9,
          },
        }),
      ).ok,
    ).toBe(false);
    for (const malformed of [
      null,
      question({ version: 0 }),
      { ...question(), source: 'remote' },
      { ...question(), type: 'quiz' },
      { ...question(), status: 'online' },
      question({ source: 'static', ownerId: 'owner' }),
      { ...question(), prompt: [] },
      { ...question(), correction: 'Réponse' },
      { ...question(), tags: [4] },
      { ...question(), createdAt: 'today' },
    ]) {
      expect(validateQuestion(malformed).ok).toBe(false);
    }
  });

  it('accepts a structurally valid parameterized question and rejects unsafe AST shapes', () => {
    const parameterized = question({
      parameterization: {
        schemaVersion: 1,
        variables: [
          {
            id: 'a',
            label: 'Coefficient',
            domain: {
              kind: 'integer',
              minimum: 1,
              maximum: 9,
              step: 1,
              excludedValues: [],
            },
          },
        ],
        constraints: [
          {
            kind: 'comparison',
            operator: 'greater-than',
            left: { kind: 'variable', variableId: 'a' },
            right: { kind: 'literal', value: 0 },
          },
        ],
        validationVariantCount: 10,
      },
    });
    expect(validateQuestion(parameterized).ok).toBe(true);
    expect(
      validateQuestion({
        ...parameterized,
        parameterization: {
          ...parameterized.parameterization,
          constraints: [{ kind: 'javascript', source: 'globalThis.alert(1)' }],
        },
      }).ok,
    ).toBe(false);

    for (const constraint of [
      {
        kind: 'unary',
        operator: 'negate',
        operand: { kind: 'literal', value: 1 },
      },
      {
        kind: 'binary',
        operator: 'add',
        left: { kind: 'literal', value: 1 },
        right: { kind: 'literal', value: 2 },
      },
      {
        kind: 'math-function',
        function: 'sqrt',
        arguments: [{ kind: 'literal', value: 4 }],
      },
      {
        kind: 'logical',
        operator: 'and',
        operands: [
          { kind: 'literal', value: true },
          { kind: 'literal', value: false },
        ],
      },
      {
        kind: 'logical-not',
        operand: { kind: 'literal', value: false },
      },
    ]) {
      expect(
        validateQuestion({
          ...parameterized,
          parameterization: {
            ...parameterized.parameterization,
            constraints: [constraint],
          },
        }).ok,
      ).toBe(true);
    }

    for (const [domain, expected] of [
      [{ kind: 'choice', values: ['a', 'b'] }, true],
      [
        {
          kind: 'decimal',
          minimum: 0,
          maximum: 1,
          decimals: 2,
          excludedValues: [],
        },
        true,
      ],
      [{ kind: 'choice', values: [] }, false],
    ] as const) {
      expect(
        validateQuestion({
          ...parameterized,
          parameterization: {
            ...parameterized.parameterization,
            variables: [{ id: 'a', label: 'A', domain }],
          },
        }).ok,
      ).toBe(expected);
    }
  });

  it('validates provenance and its source references', () => {
    const reference = {
      sourceLabel: 'Banque historique',
      sourceReference: null,
      sourceLocator: 'sheet:questions',
    };
    const provenance = {
      bundleId: 'bundle-1',
      importedAt: now,
      references: [reference],
    };
    expect(validateQuestionSourceReference(reference).ok).toBe(true);
    expect(validateQuestionProvenance(provenance).ok).toBe(true);
    expect(validateQuestion(question({ provenance })).ok).toBe(true);
    expect(
      validateQuestion(question({ provenance: 'legacy' as never })).ok,
    ).toBe(false);
    expect(
      validateQuestion({
        ...question(),
        provenance: { importedAt: now, references: [] },
      }).ok,
    ).toBe(false);
    expect(
      validateQuestion({
        ...question(),
        provenance: {
          ...provenance,
          references: [{ ...reference, sourceLabel: '' }],
        },
      }).ok,
    ).toBe(false);
  });

  it('bounds and validates safe expression ASTs without recursion', () => {
    let tooDeep: unknown = { kind: 'literal', value: 1 };
    for (let depth = 0; depth < SAFE_EXPRESSION_MAX_DEPTH; depth += 1) {
      tooDeep = { kind: 'logical-not', operand: tooDeep };
    }
    expect(validateSafeExpression(tooDeep).ok).toBe(false);

    const groups = Array.from({ length: 32 }, () => ({
      kind: 'logical',
      operator: 'and',
      operands: Array.from({ length: 8 }, () => ({
        kind: 'literal',
        value: true,
      })),
    }));
    const tooManyNodes = {
      kind: 'logical',
      operator: 'or',
      operands: groups,
    };
    expect(SAFE_EXPRESSION_MAX_NODES).toBe(256);
    expect(validateSafeExpression(tooManyNodes).ok).toBe(false);
    expect(SAFE_EXPRESSION_MAX_LIST_ITEMS).toBe(32);
    expect(
      validateSafeExpression({
        kind: 'math-function',
        function: 'max',
        arguments: Array.from(
          { length: SAFE_EXPRESSION_MAX_LIST_ITEMS + 1 },
          () => ({ kind: 'literal', value: 1 }),
        ),
      }).ok,
    ).toBe(false);
    expect(
      validateSafeExpression({
        kind: 'math-function',
        function: 'sqrt',
        arguments: [
          { kind: 'literal', value: 1 },
          { kind: 'literal', value: 2 },
        ],
      }).ok,
    ).toBe(false);
    expect(
      validateSafeExpression({
        kind: 'math-function',
        function: 'min',
        arguments: [{ kind: 'literal', value: 1 }],
      }).ok,
    ).toBe(false);
    expect(
      validateSafeExpression({
        kind: 'logical',
        operator: 'and',
        operands: [{ kind: 'literal', value: true }],
      }).ok,
    ).toBe(false);
  });

  it('rejects unknown variables in published constraints', () => {
    expect(
      validateQuestion(
        question({
          parameterization: {
            schemaVersion: 1,
            variables: [],
            constraints: [{ kind: 'variable', variableId: 'missing' }],
            validationVariantCount: 10,
          },
        }),
      ).ok,
    ).toBe(false);
  });

  it('distinguishes reflex question difficulty from reflex filters', () => {
    const reflex = question({ type: 'reflex', difficulty: null });
    expect(validateQuestion(reflex).ok).toBe(true);
    expect(
      validateQuestion(question({ type: 'reflex', difficulty: 'standard' })).ok,
    ).toBe(false);
    expect(
      validateFreeRevisionFilters({
        part: { kind: 'all' },
        chapter: { kind: 'all' },
        notion: { kind: 'all' },
        questionType: { kind: 'one', value: 'reflex' },
        difficulty: { kind: 'not-applicable' },
      }).ok,
    ).toBe(true);
    expect(
      validateFreeRevisionFilters({
        part: { kind: 'all' },
        chapter: { kind: 'all' },
        notion: { kind: 'all' },
        questionType: { kind: 'one', value: 'reflex' },
        difficulty: null,
      }).ok,
    ).toBe(false);
  });

  it('creates an immutable coherent QuestionInstance snapshot', () => {
    const frozenQuestion = question();
    const source = {
      id: 'instance-1',
      questionId: frozenQuestion.id,
      questionVersion: frozenQuestion.version,
      sessionId: 'session-1',
      ordinal: 0,
      frozenQuestion,
      parameterValues: {},
      seed: 'seed-1',
      createdAt: now,
    };
    const result = createQuestionInstance(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.frozenQuestion.prompt)).toBe(true);
    expect(
      Object.isFrozen(result.value.frozenQuestion.correction[0]?.content),
    ).toBe(true);
    expect(Object.isFrozen(result.value.parameterValues)).toBe(true);
    expect(Object.keys(result.value)).toEqual([
      'id',
      'questionId',
      'questionVersion',
      'sessionId',
      'ordinal',
      'frozenQuestion',
      'parameterValues',
      'seed',
      'createdAt',
    ]);
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(frozenQuestion)).toBe(false);
    expect(Object.isFrozen(frozenQuestion.prompt)).toBe(false);
    expect(frozenQuestion).toEqual(question());
    expect(
      createQuestionInstance({
        ...result.value,
        questionVersion: 2,
      }).ok,
    ).toBe(false);

    for (const parameterValue of [
      { nested: true },
      [1],
      Number.NaN,
      Infinity,
    ]) {
      expect(
        createQuestionInstance({
          id: 'instance-invalid',
          questionId: frozenQuestion.id,
          questionVersion: frozenQuestion.version,
          sessionId: 'session-1',
          ordinal: 0,
          frozenQuestion,
          parameterValues: { invalid: parameterValue } as never,
          seed: 'seed-1',
          createdAt: now,
        }).ok,
      ).toBe(false);
    }
  });

  it('rejects malformed instance roots and exotic parameter records without throwing', () => {
    const frozenQuestion = question();
    const base = {
      id: 'instance-1',
      questionId: frozenQuestion.id,
      questionVersion: frozenQuestion.version,
      sessionId: 'session-1',
      ordinal: 0,
      frozenQuestion,
      parameterValues: {},
      seed: 'seed-1',
      createdAt: now,
    };
    for (const malformed of [
      null,
      undefined,
      'instance',
      42,
      [],
      {},
      { ...base, parameterValues: new Date() },
      { ...base, parameterValues: new Map() },
      { ...base, parameterValues: new Set() },
    ]) {
      expect(() => createQuestionInstance(malformed)).not.toThrow();
      expect(createQuestionInstance(malformed).ok).toBe(false);
    }

    class ParameterBag {
      value = 1;
    }
    expect(
      createQuestionInstance({
        ...base,
        parameterValues: new ParameterBag(),
      }).ok,
    ).toBe(false);

    const withSymbol = { value: 1, [Symbol('hidden')]: true };
    expect(
      createQuestionInstance({ ...base, parameterValues: withSymbol }).ok,
    ).toBe(false);

    const nullPrototypeValues = Object.assign(Object.create(null) as object, {
      text: 'x',
      checked: true,
      count: 2,
    });
    expect(
      createQuestionInstance({
        ...base,
        parameterValues: nullPrototypeValues,
      }).ok,
    ).toBe(true);

    const cyclic = { ...base } as typeof base & { self?: unknown };
    cyclic.self = cyclic;
    expect(() => createQuestionInstance(cyclic)).not.toThrow();
    const cyclicResult = createQuestionInstance(cyclic);
    expect(cyclicResult.ok).toBe(true);
    if (cyclicResult.ok) {
      expect('self' in cyclicResult.value).toBe(false);
      expect(Object.isFrozen(cyclic)).toBe(false);
    }
  });
});

describe('session state unions', () => {
  it('keeps daily and weak-points states explicit', () => {
    const daily: DailyPlanState = { kind: 'none-scheduled' };
    const weak: WeakPointsState = {
      kind: 'calibrating',
      evidence: null,
      message: 'Calibration en cours.',
    };
    expect(daily.kind).toBe('none-scheduled');
    expect(weak.kind).toBe('calibrating');
  });

  it('validates coherent CalibrationEvidence', () => {
    expect(
      validateCalibrationEvidence({
        observedEvidence: 3,
        requiredEvidence: 10,
        coveredNotions: 2,
        requiredCoveredNotions: 5,
      }).ok,
    ).toBe(true);
    expect(
      validateCalibrationEvidence({
        observedEvidence: -1,
        requiredEvidence: 0,
        coveredNotions: null,
        requiredCoveredNotions: 5,
      }).ok,
    ).toBe(false);
    expect(validateCalibrationEvidence(null).ok).toBe(false);
    expect(
      validateCalibrationEvidence({
        observedEvidence: 1,
        requiredEvidence: 2,
        coveredNotions: 1,
        requiredCoveredNotions: null,
      }).ok,
    ).toBe(false);
  });

  it('limits ChapterTestPreparation to configuration and stock', () => {
    expect(
      validateChapterTestPreparation({
        kind: 'available',
        chapterId: 'chapter-1',
        questionCount: 20,
        compatibleQuestionCount: 21,
      }).ok,
    ).toBe(true);
    expect(
      validateChapterTestPreparation({
        kind: 'insufficient-stock',
        chapterId: 'chapter-1',
        questionCount: 40,
        compatibleQuestionCount: 12,
      }).ok,
    ).toBe(true);
    expect(
      validateChapterTestPreparation({
        kind: 'available',
        chapterId: 'chapter-1',
        questionCount: 40,
        compatibleQuestionCount: 40,
        blueprint: {},
      }).ok,
    ).toBe(false);
    expect(
      validateChapterTestPreparation({
        kind: 'unavailable',
        message: 'Stock indisponible.',
      }).ok,
    ).toBe(true);
    expect(
      validateChapterTestPreparation({
        kind: 'insufficient-stock',
        chapterId: 'chapter-1',
        questionCount: 20,
        compatibleQuestionCount: 20,
      }).ok,
    ).toBe(false);
    expect(validateChapterTestPreparation(null).ok).toBe(false);
    expect(
      validateChapterTestPreparation({
        status: 'available',
        chapterId: 'chapter-1',
        questionCount: 20,
        compatibleQuestionCount: 20,
      }).ok,
    ).toBe(false);
  });
});

describe('domain dependency boundary', () => {
  it('does not import React, DOM, IndexedDB, Supabase or KaTeX', () => {
    const sources = import.meta.glob('/src/domain/**/*.ts', {
      eager: true,
      import: 'default',
      query: '?raw',
    });
    const combined = Object.values(sources).join('\n');
    expect(combined).not.toMatch(
      /(?:from|import\s*\()\s*['"](?:react|react-dom|@supabase|idb|katex)/,
    );
    expect(combined).not.toMatch(
      /(?<![\w.])(?:document|window)\s*\.|(?<![\w.])indexedDB\s*[.(]/,
    );
  });
});
