import type { Question } from '../questions/Question';
import type { Quizz } from '../questions/quizz/Quizz';

export type QuestionMutationKind = 'create' | 'update' | 'archive' | 'publish';

export interface QuestionOutboxOperation {
  readonly operationId: string;
  readonly userId: string;
  readonly entity: 'question';
  readonly entityId: string;
  readonly kind: QuestionMutationKind;
  readonly baseVersion: number | null;
  readonly payload: Readonly<Question>;
  readonly createdAt: string;
}

export type QuizzTaxonomyOutboxOperation = Readonly<{
  operationId: string;
  userId: string;
  entity: 'quizz';
  entityId: string;
  kind: 'create' | 'update';
  payload: Quizz;
  createdAt: string;
}>;

export type QuestionWorkspaceOutboxOperation =
  | QuestionOutboxOperation
  | QuizzTaxonomyOutboxOperation;

export interface QuestionSyncConflict {
  readonly id: string;
  readonly userId: string;
  readonly entityId: string;
  readonly operationId: string;
  readonly local: Readonly<Question>;
  readonly remote: Readonly<Question>;
  readonly detectedAt: string;
}

export interface QuestionWorkspaceSnapshot {
  readonly questions: readonly Readonly<Question>[];
  readonly quizzes: readonly Quizz[];
  readonly pendingOperationCount: number;
  readonly conflicts: readonly QuestionSyncConflict[];
}

export interface QuestionWorkspaceRepository {
  load(userId: string): Promise<QuestionWorkspaceSnapshot>;
  saveQuestion(
    userId: string,
    question: Readonly<Question>,
    kind: QuestionMutationKind,
    operationId: string,
  ): Promise<void>;
  saveQuestionWithQuizz(
    userId: string,
    question: Readonly<Question>,
    quizz: Readonly<Quizz> | null,
    operationIds: Readonly<{
      question: string;
      quizz: string | null;
    }>,
  ): Promise<void>;
  saveQuizz(
    userId: string,
    quizz: Readonly<Quizz>,
    operationId: string,
    kind?: 'create' | 'update',
  ): Promise<void>;
  resolveConflict(
    userId: string,
    conflictId: string,
    choice: 'local' | 'remote' | 'duplicate',
  ): Promise<void>;
  listOutbox(
    userId: string,
  ): Promise<readonly QuestionWorkspaceOutboxOperation[]>;
  completeOperation(userId: string, operationId: string): Promise<void>;
  applyRemoteWorkspace(
    userId: string,
    changes: Readonly<{
      questions: readonly Readonly<Question>[];
      quizzes: readonly Quizz[];
    }>,
  ): Promise<void>;
  recordConflict(userId: string, conflict: QuestionSyncConflict): Promise<void>;
}
