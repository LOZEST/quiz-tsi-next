import { createProgramIndex, validateProgram } from '@domain/program/Program';
import { validateQuestionBankBundle } from '@domain/questions/QuestionBank';
import { InMemoryQuestionRepository } from '@infrastructure/questions/InMemoryQuestionRepository';
import numProductionBundle from '../../data/question-banks/num-production-v1.json';
import officialProgram from '../../data/program/official-program-v1.json';
import type { RevisionTestServices } from './RevisionServicesComposition';

const program = validateProgram(officialProgram);
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
