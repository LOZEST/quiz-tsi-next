import type { QuestionEvaluation } from '../evaluation/QuestionEvaluation';

export interface EvaluationRepository {
  append(evaluation: QuestionEvaluation, userId: string): Promise<void>;
  listByUser(userId: string): Promise<readonly QuestionEvaluation[]>;
  listBySession(
    sessionId: string,
    userId: string,
  ): Promise<readonly QuestionEvaluation[]>;
}
