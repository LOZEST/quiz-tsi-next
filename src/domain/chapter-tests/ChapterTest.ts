import {
  createQuestionInstance,
  type FrozenQuestionInstance,
} from '../questions/Question';
import type { PreparedQuestion } from '../questions/PreparedQuestion';
import type { QuestionRepository } from '../repositories/QuestionRepository';
import { selectFreeRevisionQuestions } from '../questions/QuestionSelection';
import { deepFreezeOwned } from '../validation/SafeSnapshot';

export interface ChapterTestBlueprint {
  readonly id: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly chapterId: string;
  readonly questionCount: 20 | 40;
  readonly seed: string;
  readonly orderedQuestionInstances: readonly FrozenQuestionInstance[];
  readonly createdAt: string;
}

export type ChapterTestStatus = 'active' | 'submitted' | 'abandoned';
export interface ChapterTestSession {
  readonly blueprint: ChapterTestBlueprint;
  readonly currentIndex: number;
  readonly status: ChapterTestStatus;
  readonly updatedAt: string;
}

function contentHash(prepared: PreparedQuestion): string {
  return `${prepared.questionId}:${prepared.questionVersion}:${prepared.seed}`;
}

export function createChapterTestBlueprint(input: {
  id: string;
  userId: string;
  sessionId: string;
  chapterId: string;
  questionCount: 20 | 40;
  seed: string;
  createdAt: string;
  repository: QuestionRepository;
}): ChapterTestBlueprint | null {
  // No questionWeights argument: a chapter test stays a neutral, representative
  // draw even for a user with heavy recurrence history — only free/daily/
  // weak-points revision (RevisionExperienceProvider.attemptFree) biases toward
  // missed questions.
  const selected = selectFreeRevisionQuestions(
    input.repository,
    {
      part: { kind: 'all' },
      chapter: { kind: 'one', value: input.chapterId },
      notion: { kind: 'all' },
      questionType: { kind: 'all' },
      difficulty: { kind: 'all' },
    },
    input.seed,
    input.questionCount,
  );
  if (selected.kind !== 'ready') return null;
  const orderedQuestionInstances = selected.items.map((prepared, ordinal) => {
    const question = input.repository.getByIdAndVersion(
      prepared.questionId,
      prepared.questionVersion,
    );
    if (!question) throw new Error('Question préparée indisponible.');
    const instance = createQuestionInstance({
      id: `${input.sessionId}:question:${ordinal + 1}`,
      questionId: question.id,
      questionVersion: question.version,
      sessionId: input.sessionId,
      ordinal,
      frozenQuestion: question,
      parameterValues: prepared.parameterValues,
      seed: prepared.seed,
      createdAt: input.createdAt,
    });
    if (!instance.ok) throw new Error('QuestionInstance invalide.');
    return { ...instance.value, contentHash: contentHash(prepared) };
  });
  return deepFreezeOwned({
    id: input.id,
    userId: input.userId,
    sessionId: input.sessionId,
    chapterId: input.chapterId,
    questionCount: input.questionCount,
    seed: input.seed,
    createdAt: input.createdAt,
    orderedQuestionInstances,
  });
}

export function moveChapterTest(
  session: ChapterTestSession,
  index: number,
  updatedAt: string,
): ChapterTestSession {
  if (
    session.status !== 'active' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= session.blueprint.questionCount
  )
    return session;
  return deepFreezeOwned({ ...session, currentIndex: index, updatedAt });
}

export function finishChapterTest(
  session: ChapterTestSession,
  status: Exclude<ChapterTestStatus, 'active'>,
  updatedAt: string,
): ChapterTestSession {
  if (session.status !== 'active') return session;
  return deepFreezeOwned({ ...session, status, updatedAt });
}
