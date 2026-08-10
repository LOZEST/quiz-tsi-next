import type { Question } from '../questions/Question';
import type {
  PersonalChapter,
  PersonalCourse,
  PersonalNotion,
} from '../questions/personal-taxonomy/PersonalTaxonomy';
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
      courses: readonly PersonalCourse[];
      chapters: readonly PersonalChapter[];
      notions: readonly PersonalNotion[];
      rejectedRows: readonly Readonly<{
        index: number;
        message: string;
      }>[];
    }>
  >;
}
