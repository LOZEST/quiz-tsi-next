import type { SupabaseClient } from '@supabase/supabase-js';
import { validateQuestion, type Question } from '@domain/questions/Question';
import type { QuestionRemoteGateway } from '@domain/repositories/QuestionRemoteGateway';
import type { QuestionOutboxOperation } from '@domain/repositories/QuestionWorkspaceRepository';

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
  async push(operation: QuestionOutboxOperation) {
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
    const response = (await this.client
      .from('questions')
      .select('*')
      .or(`owner_id.eq.${userId},source.eq.shared`)
      .order('updated_at', { ascending: false })
      .limit(Math.min(100, Math.max(1, limit)))) as {
      data: unknown;
      error: { message?: string } | null;
    };
    const { data, error } = response;
    if (error) throw new Error('Récupération des questions impossible.');
    if (!Array.isArray(data)) return [];
    return data.map(questionFromRemoteRow);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
