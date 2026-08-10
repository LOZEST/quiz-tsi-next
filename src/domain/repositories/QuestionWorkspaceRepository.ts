import type { Question } from '../questions/Question';
import type {
  PersonalChapter,
  PersonalCourse,
  PersonalNotion,
} from '../questions/personal-taxonomy/PersonalTaxonomy';

export type QuestionMutationKind = 'create' | 'update' | 'archive' | 'publish';

export interface QuestionOutboxOperation {
  readonly operationId: string;
  readonly userId: string;
  readonly entityId: string;
  readonly kind: QuestionMutationKind;
  readonly baseVersion: number | null;
  readonly payload: Readonly<Question>;
  readonly createdAt: string;
}

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
  readonly courses: readonly PersonalCourse[];
  readonly chapters: readonly PersonalChapter[];
  readonly notions: readonly PersonalNotion[];
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
  savePersonalCourse(userId: string, course: PersonalCourse): Promise<void>;
  savePersonalChapter(userId: string, chapter: PersonalChapter): Promise<void>;
  savePersonalNotion(userId: string, notion: PersonalNotion): Promise<void>;
  resolveConflict(
    userId: string,
    conflictId: string,
    choice: 'local' | 'remote' | 'duplicate',
  ): Promise<void>;
  listOutbox(userId: string): Promise<readonly QuestionOutboxOperation[]>;
  completeOperation(userId: string, operationId: string): Promise<void>;
  applyRemoteQuestions(
    userId: string,
    questions: readonly Readonly<Question>[],
  ): Promise<void>;
  recordConflict(userId: string, conflict: QuestionSyncConflict): Promise<void>;
}
