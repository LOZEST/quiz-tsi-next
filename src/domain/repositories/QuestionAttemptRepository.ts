import type { QuestionAttemptDraft } from '../evaluation/QuestionEvaluation';

export interface QuestionAttemptRepository {
  save(draft: QuestionAttemptDraft, userId: string): Promise<void>;
  get(
    questionInstanceId: string,
    userId: string,
  ): Promise<QuestionAttemptDraft | null>;
}
