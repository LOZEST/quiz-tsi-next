import { createProgramIndex, validateProgram } from '@domain/program/Program';
import { validateQuestionBankBundle } from '@domain/questions/QuestionBank';
import { InMemoryQuestionRepository } from '@infrastructure/questions/InMemoryQuestionRepository';
import numProductionBundle from '../../data/question-banks/num-production-v1.json';
import type { RevisionTestServices } from './RevisionServicesComposition';

const program = validateProgram({
  schemaVersion: 1,
  parts: [{ id: 'numbers', label: 'Nombres', order: 0 }],
  chapters: [
    {
      id: 'numbers-arithmetic',
      partId: 'numbers',
      label: 'Nombres et arithmétique',
      order: 0,
    },
  ],
  notions: [
    {
      id: 'NUM-F01',
      chapterId: 'numbers-arithmetic',
      label: 'Calcul d’une expression et classement dans les ensembles',
      order: 0,
    },
    {
      id: 'NUM-F02',
      chapterId: 'numbers-arithmetic',
      label: 'Divisibilité, parité, multiples et décomposition première',
      order: 1,
    },
    {
      id: 'NUM-F03',
      chapterId: 'numbers-arithmetic',
      label: 'Lois des puissances à base commune',
      order: 2,
    },
    {
      id: 'NUM-F04',
      chapterId: 'numbers-arithmetic',
      label: 'Simplification à puissances, racines et substitutions',
      order: 3,
    },
  ],
});
if (!program.ok) throw new Error('Programme NUM de production invalide.');

export const productionProgramIndex = createProgramIndex(program.value);
const bundle = validateQuestionBankBundle(
  numProductionBundle,
  productionProgramIndex,
);
if (!bundle.ok)
  throw new Error(
    `Banque NUM de production invalide : ${bundle.issues[0]?.path ?? 'bundle'} — ${bundle.issues[0]?.message ?? 'erreur inconnue'}`,
  );

export const productionQuestionRepository = new InMemoryQuestionRepository();
const imported = productionQuestionRepository.importAndReplace(
  JSON.parse(JSON.stringify(numProductionBundle)) as unknown,
  productionProgramIndex,
);
if (imported.kind !== 'ready')
  throw new Error(
    `Import atomique de la banque NUM impossible : ${JSON.stringify(imported.report)}`,
  );

export function createRevisionTestServices(): RevisionTestServices {
  return {
    programIndex: productionProgramIndex,
    questionRepository: productionQuestionRepository,
  };
}
