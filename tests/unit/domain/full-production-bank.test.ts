import { describe, expect, it } from 'vitest';
import rawBundle from '../../../src/data/question-banks/full-production-v1.json';
import rawProgram from '../../../src/data/program/official-program-v2.json';
import rawAudit from '../../fixtures/full-production-bank-audit.json';
import {
  createProgramIndex,
  validateProgram,
  type Program,
} from '@domain/program/Program';
import {
  validateQuestionBankBundle,
  type QuestionBankBundle,
} from '@domain/questions/QuestionBank';
import { QuestionBankIndex } from '@domain/questions/QuestionBankIndex';
import { instantiateQuestionVariant } from '@domain/questions/QuestionInstantiation';
import {
  generateParameterAssignment,
  serializeParameterValues,
} from '@domain/questions/ParameterizedQuestionGenerator';
import {
  questionClassification,
  validateQuestion,
  type ParameterPrimitive,
  type Question,
} from '@domain/questions/Question';
import {
  productionProgramIndex,
  productionQuestionRepository,
} from '@infrastructure/session/ProductionRevisionServices';

interface FullBankAudit {
  readonly total: number;
  readonly principal: number;
  readonly automatisme: number;
  readonly uniqueIds: number;
  readonly principalNotions: number;
  readonly invalidRows: readonly unknown[];
  readonly unmappedRows: readonly unknown[];
  readonly unsupportedParameterSchemas: readonly unknown[];
  readonly unsupportedRelations: readonly unknown[];
  readonly unknownParameterReferences: readonly unknown[];
  readonly countsByAutomationCategory: Readonly<Record<string, number>>;
  readonly sourceTests: readonly Readonly<{
    calculId: string;
    vectors: readonly Readonly<{
      test: number;
      resolvedParameters: Readonly<Record<string, ParameterPrimitive>>;
      serializedParameters: string;
    }>[];
  }>[];
}

const bundle = rawBundle as unknown as QuestionBankBundle;
const program = rawProgram as unknown as Program;
const audit = rawAudit as unknown as FullBankAudit;
const entries = bundle.questions;
const questions = entries.map(({ question }) => question);
const byId = new Map(questions.map((question) => [question.id, question]));
const officialNotionId = (question: Question): string => {
  const classification = questionClassification(question);
  if (classification?.kind !== 'official')
    throw new Error(`${question.id}: classification officielle absente.`);
  return classification.notionId;
};

function containsUnresolvedParameter(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !Array.isArray(value) &&
    (value as Record<string, unknown>).kind === 'parameter'
  )
    return true;
  return Object.values(value).some(containsUnresolvedParameter);
}

describe('banque complète de production', () => {
  it('conserve exactement les invariants bloquants de la source', () => {
    expect(audit).toMatchObject({
      total: 1765,
      principal: 1230,
      automatisme: 535,
      uniqueIds: 1765,
      principalNotions: 82,
      invalidRows: [],
      unmappedRows: [],
      unsupportedParameterSchemas: [],
      unsupportedRelations: [],
      unknownParameterReferences: [],
    });
    expect(entries).toHaveLength(1765);
    expect(new Set(questions.map(({ id }) => id)).size).toBe(1765);
    expect(questions.filter(({ type }) => type === 'calculation')).toHaveLength(
      1230,
    );
    expect(questions.filter(({ type }) => type === 'reflex')).toHaveLength(535);
    expect(questions.every(({ source }) => source === 'static')).toBe(true);
    expect(questions.every(({ ownerId }) => ownerId === null)).toBe(true);
    expect(questions.every(({ status }) => status === 'published')).toBe(true);
    expect(questions.every(({ validated }) => validated)).toBe(true);
  });

  it('préserve la distribution 5/5/5 de chacune des 82 notions', () => {
    const principal = questions.filter(({ type }) => type === 'calculation');
    const notionIds = new Set(principal.map(officialNotionId));
    expect(notionIds.size).toBe(82);
    for (const notionId of notionIds) {
      const stock = principal.filter(
        (question) => officialNotionId(question) === notionId,
      );
      expect(stock, notionId).toHaveLength(15);
      expect(
        stock.filter(({ difficulty }) => difficulty === 'fundamental'),
      ).toHaveLength(5);
      expect(
        stock.filter(({ difficulty }) => difficulty === 'standard'),
      ).toHaveLength(5);
      expect(
        stock.filter(({ difficulty }) => difficulty === 'trap'),
      ).toHaveLength(5);
    }
    expect(
      principal.filter(({ difficulty }) => difficulty === 'fundamental'),
    ).toHaveLength(410);
    expect(
      principal.filter(({ difficulty }) => difficulty === 'standard'),
    ).toHaveLength(410);
    expect(
      principal.filter(({ difficulty }) => difficulty === 'trap'),
    ).toHaveLength(410);
    expect(
      questions
        .filter(({ type }) => type === 'reflex')
        .every(({ difficulty }) => difficulty === null),
    ).toBe(true);
  });

  it('valide les 1 765 questions et le bundle contre les 82 notions', () => {
    const validatedProgram = validateProgram(program);
    expect(validatedProgram.ok).toBe(true);
    if (!validatedProgram.ok) return;
    expect(validatedProgram.value.parts).toHaveLength(8);
    expect(validatedProgram.value.chapters).toHaveLength(14);
    expect(validatedProgram.value.notions).toHaveLength(82);
    for (const question of questions)
      expect(validateQuestion(question).ok, question.id).toBe(true);
    const validatedBundle = validateQuestionBankBundle(
      bundle,
      createProgramIndex(validatedProgram.value),
    );
    expect(validatedBundle.ok).toBe(true);
    expect(productionQuestionRepository.getBankMetadata()).toMatchObject({
      bundleId: 'quiz-tsi-official-full-v1',
      questionCount: 1765,
    });
    expect(productionProgramIndex.getAllNotions()).toHaveLength(82);
  });

  it('instancie les 3 050 vecteurs source sans référence non résolue', () => {
    let vectors = 0;
    for (const sourceTest of audit.sourceTests) {
      const question = byId.get(sourceTest.calculId);
      expect(question, sourceTest.calculId).toBeDefined();
      if (!question) continue;
      for (const vector of sourceTest.vectors) {
        const result = instantiateQuestionVariant(
          question,
          vector.resolvedParameters,
        );
        expect(result.ok, `${sourceTest.calculId}:Test${vector.test}`).toBe(
          true,
        );
        if (!result.ok) continue;
        expect(
          containsUnresolvedParameter(result.value),
          `${sourceTest.calculId}:Test${vector.test}`,
        ).toBe(false);
        const text = [
          ...result.value.prompt,
          ...result.value.hint,
          ...result.value.correction.flatMap((step) => step.content),
        ]
          .filter((segment) => segment.kind === 'text')
          .map((segment) => (segment.kind === 'text' ? segment.value : ''))
          .join(' ');
        expect(text, `${sourceTest.calculId}:Test${vector.test}`).not.toMatch(
          /@[A-Za-z][A-Za-z0-9_]*/,
        );
        expect(vector.serializedParameters).toBe(
          serializeParameterValues(vector.resolvedParameters, [
            ...(question.parameterization?.variables.map((entry) => entry.id) ??
              []),
            ...(question.parameterization?.derivedVariables?.map(
              (entry) => entry.id,
            ) ?? []),
          ]),
        );
        vectors += 1;
      }
    }
    expect(vectors).toBe(3050);
  });

  it('couvre chaque famille notionnelle et chaque catégorie AUTO', () => {
    expect(
      new Set(
        questions
          .filter(({ type }) => type === 'calculation')
          .map((question) => officialNotionId(question).split('-')[0]),
      ),
    ).toEqual(
      new Set([
        'NUM',
        'ALG',
        'EQI',
        'SUI',
        'FON',
        'TRI',
        'DER',
        'ANA',
        'INT',
        'CPL',
        'PRO',
        'GEO',
        'MES',
        'ALGO',
      ]),
    );
    expect(audit.countsByAutomationCategory).toEqual({
      FONCTIONS_REFERENCE: 104,
      DOMAINES: 30,
      TRIGONOMETRIE: 68,
      HYPERBOLIQUES: 8,
      DEVELOPPEMENTS_LIMITES: 10,
      DERIVEES: 130,
      PRIMITIVES: 185,
    });
  });

  it('indexe et filtre sans revalider la banque à chaque requête', () => {
    const published = productionQuestionRepository.listPublished();
    expect(published).toHaveLength(1765);
    const index = new QuestionBankIndex([...published] as Question[]);
    expect(index.query({ partId: 'complex-numbers' })).toMatchObject({
      ok: true,
    });
    expect(index.query({ chapterId: 'sequences' })).toMatchObject({ ok: true });
    expect(index.query({ notionId: 'ALG-F01' })).toMatchObject({ ok: true });
    const reflex = index.query({
      type: 'reflex',
      difficulty: 'not-applicable',
    });
    expect(reflex.ok && reflex.questions).toHaveLength(535);
    const traps = index.query({ type: 'calculation', difficulty: 'trap' });
    expect(traps.ok && traps.questions).toHaveLength(410);
  });

  it('génère la même variante avec la même seed', () => {
    const candidates = questions.filter(
      ({ parameterization }) =>
        parameterization !== null &&
        parameterization.validationVariantCount >= 2,
    );
    expect(candidates.length).toBeGreaterThan(0);
    for (const question of candidates.slice(0, 100)) {
      const first = generateParameterAssignment(
        question.parameterization,
        `${question.id}:stable`,
      );
      const repeated = generateParameterAssignment(
        question.parameterization,
        `${question.id}:stable`,
      );
      expect(first, question.id).toEqual(repeated);
    }
  });
});
