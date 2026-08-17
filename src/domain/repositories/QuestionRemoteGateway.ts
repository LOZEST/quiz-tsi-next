import type { Question } from '../questions/Question';
import type { Quizz } from '../questions/quizz/Quizz';
import type { QuestionWorkspaceOutboxOperation } from './QuestionWorkspaceRepository';

export type QuestionPushResult =
  | Readonly<{ kind: 'accepted' }>
  | Readonly<{ kind: 'conflict'; remote: Readonly<Question> }>
  | Readonly<{ kind: 'taxonomy-conflict' }>
  | Readonly<{ kind: 'permission-denied' }>;
export interface QuestionRemoteGateway {
  push(
    operation: QuestionWorkspaceOutboxOperation,
  ): Promise<QuestionPushResult>;
  pullRecent(
    userId: string,
    limit: number,
  ): Promise<
    Readonly<{
      questions: readonly Readonly<Question>[];
      quizzes: readonly Quizz[];
      rejectedRows: readonly Readonly<{
        index: number;
        message: string;
      }>[];
    }>
  >;
}
