import type { SupabaseClient } from '@supabase/supabase-js';
import { validateQuestion, type Question } from '@domain/questions/Question';
import { latestQuestionVersions } from '@domain/questions/LatestQuestionVersions';
import type {
  PersonalChapter,
  PersonalCourse,
  PersonalNotion,
} from '@domain/questions/personal-taxonomy/PersonalTaxonomy';
import type { QuestionRemoteGateway } from '@domain/repositories/QuestionRemoteGateway';
import type { QuestionWorkspaceOutboxOperation } from '@domain/repositories/QuestionWorkspaceRepository';

const rowFor = (question: Readonly<Question>) => ({
  id: question.id,
  version: question.version,
  owner_id: question.ownerId,
  source: question.source,
  status: question.status,
  validated: question.validated,
  classification: question.classification,
  type: question.type,
  difficulty: question.difficulty,
  content: {
    prompt: question.prompt,
    hint: question.hint,
    correction: question.correction,
  },
  parameterization: question.parameterization,
  tags: question.tags,
  provenance: question.provenance,
  created_at: question.createdAt,
  updated_at: question.updatedAt,
});
export const questionFromRemoteRow = (row: unknown): Question => {
  if (!isRecord(row) || !isRecord(row.content))
    throw new Error('Question distante invalide.');
  const candidate = {
    id: String(row.id),
    version: Number(row.version),
    ownerId: typeof row.owner_id === 'string' ? row.owner_id : null,
    source: row.source,
    status: row.status,
    validated: row.validated,
    classification: row.classification,
    type: row.type,
    difficulty: row.difficulty,
    prompt: row.content.prompt,
    hint: row.content.hint,
    correction: row.content.correction,
    parameterization: row.parameterization,
    tags: row.tags,
    provenance: row.provenance,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
  const validated = validateQuestion(candidate);
  if (!validated.ok)
    throw new Error(
      `Question distante invalide : ${validated.issues[0]?.path ?? 'row'}.`,
    );
  return validated.value;
};

export class SupabaseQuestionRemoteGateway implements QuestionRemoteGateway {
  constructor(private readonly client: SupabaseClient) {}
  async push(operation: QuestionWorkspaceOutboxOperation) {
    if (operation.entity !== 'question') {
      const table = {
        course: 'personal_courses',
        chapter: 'personal_chapters',
        notion: 'personal_notions',
      }[operation.entity];
      const payload = operation.payload;
      const { error } = await this.client.from(table).insert({
        id: payload.id,
        owner_id: payload.ownerId,
        ...('courseId' in payload ? { course_id: payload.courseId } : {}),
        ...('chapterId' in payload ? { chapter_id: payload.chapterId } : {}),
        title: payload.title,
        created_at: payload.createdAt,
        updated_at: payload.updatedAt,
      });
      if (error?.code === '42501')
        return { kind: 'permission-denied' as const };
      if (error && error.code !== '23505')
        throw new Error('Synchronisation de la taxonomie impossible.');
      return { kind: 'accepted' as const };
    }
    const latestResponse = (await this.client
      .from('questions')
      .select('*')
      .eq('id', operation.entityId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: unknown };
    const latest = latestResponse.data;
    if (
      isRecord(latest) &&
      operation.baseVersion !== null &&
      Number(latest.version) !== operation.baseVersion
    )
      return {
        kind: 'conflict' as const,
        remote: questionFromRemoteRow(latest),
      };
    const { error } = await this.client
      .from('questions')
      .insert(rowFor(operation.payload));
    if (error?.code === '42501') return { kind: 'permission-denied' as const };
    if (error) throw new Error('Synchronisation de la question impossible.');
    return { kind: 'accepted' as const };
  }
  async pullRecent(userId: string, limit: number) {
    const boundedLimit = Math.min(100, Math.max(1, limit));
    const [questionResponse, courseResponse, chapterResponse, notionResponse] =
      (await Promise.all([
        this.client
          .from('latest_accessible_questions')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(boundedLimit),
        this.client.from('personal_courses').select('*'),
        this.client.from('personal_chapters').select('*'),
        this.client.from('personal_notions').select('*'),
      ])) as readonly RemoteResponse[];
    if (
      questionResponse?.error ||
      courseResponse?.error ||
      chapterResponse?.error ||
      notionResponse?.error
    )
      throw new Error('Récupération des questions impossible.');
    const rejectedRows: { index: number; message: string }[] = [];
    const questions: Question[] = [];
    if (Array.isArray(questionResponse?.data)) {
      questionResponse.data.forEach((row, index) => {
        try {
          questions.push(questionFromRemoteRow(row));
        } catch (reason) {
          rejectedRows.push({
            index,
            message:
              reason instanceof Error
                ? reason.message
                : 'Question distante invalide.',
          });
        }
      });
    }
    return {
      questions: latestQuestionVersions(questions),
      courses: taxonomyRows(courseResponse?.data, userId, 'course'),
      chapters: taxonomyRows(chapterResponse?.data, userId, 'chapter'),
      notions: taxonomyRows(notionResponse?.data, userId, 'notion'),
      rejectedRows,
    };
  }
}

interface RemoteResponse {
  readonly data: unknown;
  readonly error: { readonly code?: string; readonly message?: string } | null;
}

function taxonomyRows(
  data: unknown,
  userId: string,
  kind: 'course',
): PersonalCourse[];
function taxonomyRows(
  data: unknown,
  userId: string,
  kind: 'chapter',
): PersonalChapter[];
function taxonomyRows(
  data: unknown,
  userId: string,
  kind: 'notion',
): PersonalNotion[];
function taxonomyRows(
  data: unknown,
  userId: string,
  kind: 'course' | 'chapter' | 'notion',
): (PersonalCourse | PersonalChapter | PersonalNotion)[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (
      !isRecord(row) ||
      typeof row.id !== 'string' ||
      row.owner_id !== userId ||
      typeof row.title !== 'string' ||
      typeof row.created_at !== 'string' ||
      typeof row.updated_at !== 'string'
    )
      return [];
    const common = {
      id: row.id,
      ownerId: userId,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    if (kind === 'course') return [common];
    if (typeof row.course_id !== 'string') return [];
    if (kind === 'chapter') return [{ ...common, courseId: row.course_id }];
    if (row.chapter_id !== null && typeof row.chapter_id !== 'string')
      return [];
    return [
      {
        ...common,
        courseId: row.course_id,
        chapterId: row.chapter_id,
      },
    ];
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
