import type { Question } from '../questions/Question';
import type { QuestionOutboxOperation } from './QuestionWorkspaceRepository';

export type QuestionPushResult =
  | Readonly<{ kind: 'accepted' }>
  | Readonly<{ kind: 'conflict'; remote: Readonly<Question> }>
  | Readonly<{ kind: 'permission-denied' }>;
export interface QuestionRemoteGateway {
  push(operation: QuestionOutboxOperation): Promise<QuestionPushResult>;
  pullRecent(
    userId: string,
    limit: number,
  ): Promise<readonly Readonly<Question>[]>;
}
