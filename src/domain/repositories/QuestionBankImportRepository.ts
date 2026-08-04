import type { ProgramIndex } from '../program/Program';
import type { QuestionBankImportResult } from '../questions/QuestionBankImporter';

export interface QuestionBankImportRepository {
  importAndReplace(
    bundle: unknown,
    program?: ProgramIndex,
  ): QuestionBankImportResult;
}
