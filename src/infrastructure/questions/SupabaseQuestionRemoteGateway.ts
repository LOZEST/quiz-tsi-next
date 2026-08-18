import type { SupabaseClient } from '@supabase/supabase-js';
import { validateQuestion, type Question } from '@domain/questions/Question';
import { latestQuestionVersions } from '@domain/questions/LatestQuestionVersions';
import type { Quizz } from '@domain/questions/quizz/Quizz';
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

const normalizeRemoteTimestamp = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value;
};

const normalizeRemoteProvenance = (value: unknown): unknown =>
  isRecord(value)
    ? {
        ...value,
        importedAt: normalizeRemoteTimestamp(value.importedAt),
      }
    : value;

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
    provenance: normalizeRemoteProvenance(row.provenance),
    createdAt: normalizeRemoteTimestamp(row.created_at),
    updatedAt: normalizeRemoteTimestamp(row.updated_at),
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
      const table = 'quizzes';
      const payload = operation.payload;
      const row = {
        id: payload.id,
        owner_id: payload.ownerId,
        title: payload.title,
        description: payload.description,
        visibility: payload.visibility,
        created_at: payload.createdAt,
        updated_at: payload.updatedAt,
        deleted_at: payload.deletedAt,
      };
      const { error } =
        operation.kind === 'update'
          ? await this.client
              .from(table)
              .update(row)
              .eq('id', payload.id)
              .eq('owner_id', payload.ownerId)
          : await this.client.from(table).insert(row);
      if (error?.code === '42501')
        return { kind: 'permission-denied' as const };
      if (error?.code === '23505') {
        const existing = await this.readTaxonomy(table, payload.id);
        return existing && taxonomyEqual(existing, payload)
          ? { kind: 'accepted' as const }
          : { kind: 'taxonomy-conflict' as const };
      }
      if (error) throw new Error('Synchronisation de la taxonomie impossible.');
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
    if (isRecord(latest)) {
      const remote = questionFromRemoteRow(latest);
      if (remote.version === operation.payload.version)
        return questionsEqual(remote, operation.payload)
          ? { kind: 'accepted' as const }
          : { kind: 'conflict' as const, remote };
      if (
        remote.version > operation.payload.version ||
        operation.baseVersion === null ||
        remote.version !== operation.baseVersion
      )
        return { kind: 'conflict' as const, remote };
    }
    const { error } = await this.client
      .from('questions')
      .insert(rowFor(operation.payload));
    if (error?.code === '42501') return { kind: 'permission-denied' as const };
    if (error?.code === '23505') {
      const replay = await this.readLatestQuestion(operation.entityId);
      if (replay && questionsEqual(replay, operation.payload))
        return { kind: 'accepted' as const };
      if (replay) return { kind: 'conflict' as const, remote: replay };
    }
    if (error) throw new Error('Synchronisation de la question impossible.');
    return { kind: 'accepted' as const };
  }
  private async readLatestQuestion(id: string): Promise<Question | null> {
    const response = (await this.client
      .from('questions')
      .select('*')
      .eq('id', id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: unknown };
    return isRecord(response.data)
      ? questionFromRemoteRow(response.data)
      : null;
  }
  private async readTaxonomy(table: string, id: string): Promise<unknown> {
    const response = (await this.client
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle()) as { data: unknown };
    return response.data;
  }
  async pullRecent(userId: string, limit: number) {
    const boundedLimit = Math.min(100, Math.max(1, limit));
    const [questionResponse, quizzResponse] = (await Promise.all([
      this.client
        .from('latest_accessible_questions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(boundedLimit),
      this.client.from('quizzes').select('*'),
    ])) as readonly RemoteResponse[];
    if (questionResponse?.error || quizzResponse?.error)
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
      quizzes: quizzRows(quizzResponse?.data, userId),
      rejectedRows,
    };
  }
}

interface RemoteResponse {
  readonly data: unknown;
  readonly error: { readonly code?: string; readonly message?: string } | null;
}

function quizzRows(data: unknown, userId: string): Quizz[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row): Quizz[] => {
    if (
      !isRecord(row) ||
      typeof row.id !== 'string' ||
      row.owner_id !== userId ||
      typeof row.title !== 'string' ||
      typeof row.created_at !== 'string' ||
      typeof row.updated_at !== 'string'
    )
      return [];
    const description =
      typeof row.description === 'string' ? row.description : '';
    const visibility = row.visibility === 'public' ? 'public' : 'private';
    return [
      {
        id: row.id,
        ownerId: userId,
        title: row.title,
        description,
        visibility,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: typeof row.deleted_at === 'string' ? row.deleted_at : null,
      },
    ];
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const questionsEqual = (
  left: Readonly<Question>,
  right: Readonly<Question>,
) => {
  const normalize = (question: Readonly<Question>) => ({
    ...rowFor(question),
    created_at: Date.parse(question.createdAt),
    updated_at: Date.parse(question.updatedAt),
  });
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
};

const taxonomyEqual = (row: unknown, payload: Quizz) => {
  if (!isRecord(row)) return false;
  return (
    row.id === payload.id &&
    row.owner_id === payload.ownerId &&
    row.title === payload.title &&
    row.description === payload.description &&
    row.visibility === payload.visibility
  );
};
