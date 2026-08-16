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
  readonly entity: 'question';
  readonly entityId: string;
  readonly kind: QuestionMutationKind;
  readonly baseVersion: number | null;
  readonly payload: Readonly<Question>;
  readonly createdAt: string;
}

export type PersonalTaxonomyOutboxOperation =
  | Readonly<{
      operationId: string;
      userId: string;
      entity: 'course';
      entityId: string;
      kind: 'create' | 'update';
      payload: PersonalCourse;
      createdAt: string;
    }>
  | Readonly<{
      operationId: string;
      userId: string;
      entity: 'chapter';
      entityId: string;
      kind: 'create';
      payload: PersonalChapter;
      createdAt: string;
    }>
  | Readonly<{
      operationId: string;
      userId: string;
      entity: 'notion';
      entityId: string;
      kind: 'create';
      payload: PersonalNotion;
      createdAt: string;
    }>;

export type QuestionWorkspaceOutboxOperation =
  | QuestionOutboxOperation
  | PersonalTaxonomyOutboxOperation;

export interface PersonalTaxonomyDraft {
  readonly course: PersonalCourse | null;
  readonly chapter: PersonalChapter | null;
  readonly notion: PersonalNotion | null;
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
  saveQuestionDraftWithPersonalTaxonomy(
    userId: string,
    question: Readonly<Question>,
    taxonomy: PersonalTaxonomyDraft,
    operationIds: Readonly<{
      question: string;
      course: string | null;
      chapter: string | null;
      notion: string | null;
    }>,
  ): Promise<void>;
  saveCourse(
    userId: string,
    course: Readonly<PersonalCourse>,
    operationId: string,
    kind?: 'create' | 'update',
  ): Promise<void>;
  saveChapter(
    userId: string,
    chapter: Readonly<PersonalChapter>,
    operationId: string,
  ): Promise<void>;
  saveNotion(
    userId: string,
    notion: Readonly<PersonalNotion>,
    operationId: string,
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
      courses: readonly PersonalCourse[];
      chapters: readonly PersonalChapter[];
      notions: readonly PersonalNotion[];
    }>,
  ): Promise<void>;
  recordConflict(userId: string, conflict: QuestionSyncConflict): Promise<void>;
}
