import { createProgramIndex, validateProgram } from '@domain/program/Program';
import { validateQuestionBankBundle } from '@domain/questions/QuestionBank';
import { InMemoryQuestionRepository } from '@infrastructure/questions/InMemoryQuestionRepository';
import fullProductionBundle from '../../data/question-banks/full-production-v1.json';
import officialProgram from '../../data/program/official-program-v2.json';
import type { RevisionTestServices } from './RevisionServicesComposition';
import { MergedQuestionRepository } from './MergedQuestionRepository';

const program = validateProgram(officialProgram);
if (!program.ok) throw new Error('Programme officiel de production invalide.');

export const productionProgramIndex = createProgramIndex(program.value);
const bundle = validateQuestionBankBundle(
  fullProductionBundle,
  productionProgramIndex,
);
if (!bundle.ok)
  throw new Error(
    `Banque complète de production invalide : ${bundle.issues[0]?.path ?? 'bundle'} — ${bundle.issues[0]?.message ?? 'erreur inconnue'}`,
  );

export const productionQuestionRepository = new InMemoryQuestionRepository();
const imported = productionQuestionRepository.importAndReplace(
  JSON.parse(JSON.stringify(fullProductionBundle)) as unknown,
  productionProgramIndex,
);
if (imported.kind !== 'ready')
  throw new Error(
    `Import atomique de la banque complète impossible : ${JSON.stringify(imported.report)}`,
  );

export const mergedQuestionRepository = new MergedQuestionRepository(
  productionQuestionRepository,
);

export function createRevisionTestServices(): RevisionTestServices {
  return {
    programIndex: productionProgramIndex,
    questionRepository: mergedQuestionRepository,
  };
}
