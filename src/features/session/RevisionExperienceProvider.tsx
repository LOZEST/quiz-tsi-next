/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAppServices } from '@app/providers/AppServicesProvider';
import { useWhiteboard } from '@app/providers/WhiteboardProvider';
import type { PreparedQuestion } from '@domain/questions/PreparedQuestion';
import { selectFreeRevisionQuestions } from '@domain/questions/QuestionSelection';
import type { Question } from '@domain/questions/Question';
import {
  createQuestionInstance,
  type QuestionInstance,
} from '@domain/questions/Question';
import {
  completeQuestionAttempt,
  createQuestionAttempt,
  markCorrectionViewed,
  markHintUsed,
  markTimeExceeded,
  restoreQuestionAttempt,
  toQuestionAttemptDraft,
  type QuestionAttemptState,
} from '@domain/evaluation/QuestionEvaluation';
import type {
  DailyPlanState,
  FreeRevisionFilters,
  SessionMode,
  WeakPointsState,
} from '@domain/session/Session';
import {
  createChapterTestBlueprint,
  finishChapterTest,
  moveChapterTest,
  type ChapterTestSession,
} from '@domain/chapter-tests/ChapterTest';
import { instantiateQuestionVariant } from '@domain/questions/QuestionInstantiation';

export const initialFreeRevisionFilters: FreeRevisionFilters = Object.freeze({
  part: { kind: 'all' as const },
  chapter: { kind: 'all' as const },
  notion: { kind: 'all' as const },
  questionType: { kind: 'all' as const },
  difficulty: { kind: 'all' as const },
});

export type ActivePreparedQuestion = Readonly<{
  prepared: PreparedQuestion;
  question: Readonly<Question>;
  reflexDeadline: number | null;
}>;

export type RevisionExperienceState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'no-program'; message: string }
  | { kind: 'no-bank'; message: string }
  | {
      kind: 'ready';
      prepared: PreparedQuestion;
      question: Readonly<Question>;
      instance: QuestionInstance;
      attempt: QuestionAttemptState;
      reflexDeadline: number | null;
    }
  | { kind: 'no-match'; message: string }
  | { kind: 'daily'; state: DailyPlanState }
  | { kind: 'weak-points'; state: WeakPointsState }
  | { kind: 'chapter-test' }
  | { kind: 'error'; code: string; message: string };

type PendingChange =
  | Readonly<{
      kind: 'free';
      filters: FreeRevisionFilters;
      excludeCurrent: boolean;
    }>
  | Readonly<{ kind: 'mode'; mode: SessionMode }>;

interface RevisionExperienceValue {
  mode: SessionMode;
  setMode: (mode: SessionMode, trigger?: HTMLElement) => void;
  state: RevisionExperienceState;
  notice: string | null;
  activeFilters: FreeRevisionFilters;
  visibleFilters: FreeRevisionFilters;
  setVisibleFilters: (
    filters: FreeRevisionFilters,
    trigger?: HTMLElement,
  ) => void;
  nextQuestion: (trigger?: HTMLElement) => void;
  hintOpen: boolean;
  correctionOpen: boolean;
  openHint: (trigger?: HTMLElement) => void;
  closeHint: () => void;
  openCorrection: (trigger?: HTMLElement) => void;
  closeCorrection: () => void;
  markReflexExceeded: () => void;
  evaluate: (action: 'success' | 'failed' | 'skipped') => Promise<void>;
  chapterTest: ChapterTestSession | null;
  startChapterTest: (
    chapterId: string,
    questionCount: 20 | 40,
  ) => Promise<boolean>;
  navigateChapterTest: (index: number) => Promise<void>;
  finishChapterTest: (status: 'submitted' | 'abandoned') => Promise<void>;
  pendingChange: boolean;
  dialogTrigger: HTMLElement | null;
  cancelChange: () => void;
  confirmChange: () => void;
}

const Context = createContext<RevisionExperienceValue | null>(null);

export function RevisionExperienceProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string;
}) {
  const services = useAppServices();
  const board = useWhiteboard();
  const [mode, setModeState] = useState<SessionMode>('free');
  const [state, setState] = useState<RevisionExperienceState>({ kind: 'idle' });
  const [notice, setNotice] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState(
    initialFreeRevisionFilters,
  );
  const [visibleFilters, setVisibleFilters] = useState(
    initialFreeRevisionFilters,
  );
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [chapterTest, setChapterTest] = useState<ChapterTestSession | null>(
    null,
  );
  const [helpTrigger, setHelpTrigger] = useState<HTMLElement | null>(null);
  const dialogTrigger: HTMLElement | null = null;
  const request = useRef(0);
  const initialLoaded = useRef(false);
  const mounted = useRef(true);

  const persistAttempt = useCallback(
    (attempt: QuestionAttemptState) => {
      if (mode !== 'chapter-test') return;
      void services.questionAttemptRepository
        .save(toQuestionAttemptDraft(attempt), userId)
        .catch(() => {
          if (mounted.current)
            setNotice('La tentative n’a pas pu être enregistrée.');
        });
    },
    [mode, services.questionAttemptRepository, userId],
  );

  const loadChapterQuestion = useCallback(
    async (session: ChapterTestSession, index: number) => {
      const instance = session.blueprint.orderedQuestionInstances[index];
      if (!instance) return;
      const content = instantiateQuestionVariant(
        instance.frozenQuestion,
        instance.parameterValues,
      );
      if (!content.ok) return;
      const [savedDraft, evaluations] = await Promise.all([
        services.questionAttemptRepository.get(instance.id, userId),
        services.evaluationRepository.listBySession(
          session.blueprint.sessionId,
          userId,
        ),
      ]);
      const evaluation =
        evaluations.find((entry) => entry.questionInstanceId === instance.id) ??
        null;
      const now = new Date(services.clock.now()).toISOString();
      const draft =
        savedDraft ??
        toQuestionAttemptDraft(
          createQuestionAttempt({
            id: services.revisionSeedSource.nextSeed(),
            userId,
            instance,
            startedAt: evaluation?.startedAt ?? now,
          }),
        );
      if (!savedDraft)
        await services.questionAttemptRepository.save(draft, userId);
      const attempt = restoreQuestionAttempt({ draft, instance, evaluation });
      if (!mounted.current) return;
      setHintOpen(false);
      setCorrectionOpen(attempt.correctionViewed);
      setState({
        kind: 'ready',
        instance,
        question: instance.frozenQuestion,
        prepared: {
          questionId: instance.questionId,
          questionVersion: instance.questionVersion,
          seed: instance.seed,
          parameterValues: instance.parameterValues,
          content: content.value,
        },
        attempt,
        reflexDeadline:
          instance.frozenQuestion.type === 'reflex' && !evaluation
            ? Date.parse(attempt.startedAt) + 60_000
            : null,
      });
    },
    [services, userId],
  );

  useEffect(
    () => () => {
      mounted.current = false;
      request.current += 1;
    },
    [],
  );

  const showAttemptFailure = useCallback(
    (next: RevisionExperienceState, message: string) => {
      if (state.kind === 'ready') setNotice(message);
      else setState(next);
    },
    [state],
  );

  const attemptFree = useCallback(
    (
      filters: FreeRevisionFilters,
      excludeCurrent = false,
      clearDraft = false,
    ) => {
      let bankMetadata;
      try {
        bankMetadata = services.questionRepository.getBankMetadata();
      } catch {
        showAttemptFailure(
          {
            kind: 'error',
            code: 'repository-error',
            message: 'La banque de questions est indisponible pour le moment.',
          },
          'La banque de questions est indisponible pour le moment.',
        );
        return false;
      }
      if (!bankMetadata) {
        setNotice(null);
        setState({
          kind: 'no-bank',
          message:
            'Aucune banque de questions validée n’est disponible pour le moment.',
        });
        return false;
      }
      const program = services.programIndex;
      if (!program) {
        setNotice(null);
        setState({
          kind: 'no-program',
          message: 'Le programme est indisponible pour le moment.',
        });
        return false;
      }
      const current = state.kind === 'ready' ? state : null;
      const result = selectFreeRevisionQuestions(
        services.questionRepository,
        filters,
        services.revisionSeedSource.nextSeed(),
        1,
        excludeCurrent && current ? [current.question.id] : [],
      );
      if (result.kind !== 'ready') {
        const message =
          excludeCurrent &&
          (result.kind === 'no-match' || result.kind === 'insufficient-stock')
            ? 'Aucune autre question compatible n’est disponible.'
            : result.message;
        if (result.kind === 'no-bank')
          showAttemptFailure({ kind: 'no-bank', message }, message);
        else if (
          result.kind === 'no-match' ||
          result.kind === 'insufficient-stock'
        )
          showAttemptFailure({ kind: 'no-match', message }, message);
        else
          showAttemptFailure(
            { kind: 'error', code: result.code, message },
            message,
          );
        return false;
      }
      const prepared = result.items[0];
      const question =
        prepared &&
        services.questionRepository.getByIdAndVersion(
          prepared.questionId,
          prepared.questionVersion,
        );
      if (!prepared || !question) {
        showAttemptFailure(
          {
            kind: 'error',
            code: 'question-missing',
            message: 'La question préparée est indisponible.',
          },
          'La question préparée est indisponible.',
        );
        return false;
      }
      const now = new Date(services.clock.now()).toISOString();
      const sessionId = `free:${userId}`;
      const ordinal =
        current?.instance.ordinal !== undefined
          ? current.instance.ordinal + 1
          : 0;
      const instanceResult = createQuestionInstance({
        id: `${sessionId}:question:${ordinal}:${prepared.seed}`,
        questionId: question.id,
        questionVersion: question.version,
        sessionId,
        ordinal,
        frozenQuestion: question,
        parameterValues: prepared.parameterValues,
        seed: prepared.seed,
        createdAt: now,
      });
      if (!instanceResult.ok) {
        showAttemptFailure(
          {
            kind: 'error',
            code: 'instance-invalid',
            message: 'La question ne peut pas être figée.',
          },
          'La question ne peut pas être figée.',
        );
        return false;
      }
      const attempt = createQuestionAttempt({
        id: `${instanceResult.value.id}:attempt`,
        userId,
        instance: instanceResult.value,
        startedAt: now,
      });
      if (clearDraft) board.clearDraft();
      setHintOpen(false);
      setCorrectionOpen(false);
      setModeState('free');
      setActiveFilters(filters);
      setVisibleFilters(filters);
      setNotice(null);
      setState({
        kind: 'ready',
        prepared,
        question,
        instance: instanceResult.value,
        attempt,
        reflexDeadline:
          question.type === 'reflex' ? services.clock.now() + 60_000 : null,
      });
      return true;
    },
    [board, services, showAttemptFailure, state, userId],
  );

  useEffect(() => {
    if (initialLoaded.current) return;
    initialLoaded.current = true;
    queueMicrotask(() => {
      if (mounted.current) attemptFree(initialFreeRevisionFilters);
    });
  }, [attemptFree]);

  const enterMode = useCallback(
    (next: SessionMode, clearDraft = false) => {
      const id = ++request.current;
      if (clearDraft) board.clearDraft();
      setModeState(next);
      setNotice(null);
      if (next === 'free') {
        attemptFree(activeFilters);
        return;
      }
      if (next === 'chapter-test') {
        setState({ kind: 'chapter-test' });
        void services.chapterTestRepository.getActive(userId).then((saved) => {
          if (!saved || !mounted.current) return;
          setChapterTest(saved);
          void loadChapterQuestion(saved, saved.currentIndex);
        });
        return;
      }
      setState({ kind: 'loading' });
      const source =
        next === 'daily'
          ? services.dailyPlanStateRepository.getState(userId)
          : services.weakPointsStateRepository.getState(userId);
      void source
        .then((value) => {
          if (!mounted.current || id !== request.current) return;
          setState(
            next === 'daily'
              ? { kind: 'daily', state: value as DailyPlanState }
              : { kind: 'weak-points', state: value as WeakPointsState },
          );
        })
        .catch(() => {
          if (mounted.current && id === request.current)
            setState({
              kind: 'error',
              code: 'state-unavailable',
              message: 'Ces données sont indisponibles pour le moment.',
            });
        });
    },
    [activeFilters, attemptFree, board, loadChapterQuestion, services, userId],
  );

  const requestFree = useCallback(
    (
      filters: FreeRevisionFilters,
      excludeCurrent: boolean,
      trigger?: HTMLElement,
    ) => {
      void trigger;
      attemptFree(filters, excludeCurrent, true);
    },
    [attemptFree],
  );

  const setFreeFilters = useCallback(
    (filters: FreeRevisionFilters, trigger?: HTMLElement) => {
      setVisibleFilters(filters);
      requestFree(filters, false, trigger);
    },
    [requestFree],
  );

  const setMode = useCallback(
    (next: SessionMode, trigger?: HTMLElement) => {
      if (next === mode) return;
      void trigger;
      enterMode(next, true);
    },
    [enterMode, mode],
  );

  const cancelChange = useCallback(() => {
    setPending(null);
    setVisibleFilters(activeFilters);
  }, [activeFilters]);

  const confirmChange = useCallback(() => {
    if (!pending) return;
    if (pending.kind === 'mode') {
      setPending(null);
      enterMode(pending.mode, true);
      return;
    }
    const change = pending;
    setPending(null);
    if (!attemptFree(change.filters, change.excludeCurrent, true))
      setVisibleFilters(activeFilters);
  }, [activeFilters, attemptFree, enterMode, pending]);

  const value = useMemo<RevisionExperienceValue>(
    () => ({
      mode,
      setMode,
      state,
      notice,
      activeFilters,
      visibleFilters,
      setVisibleFilters: setFreeFilters,
      nextQuestion: (trigger) => {
        if (
          state.kind === 'ready' &&
          state.attempt.correctionViewed &&
          !state.attempt.evaluation
        ) {
          setNotice(
            'Indique ton résultat avant de passer à la question suivante.',
          );
          return;
        }
        if (mode === 'chapter-test' && chapterTest) {
          void (async () => {
            const now = new Date(services.clock.now()).toISOString();
            const moved = moveChapterTest(
              chapterTest,
              chapterTest.currentIndex + 1,
              now,
            );
            if (moved === chapterTest) return;
            await services.chapterTestRepository.save(moved, userId);
            board.clearDraft();
            setChapterTest(moved);
            await loadChapterQuestion(moved, moved.currentIndex);
          })();
          return;
        }
        requestFree(activeFilters, true, trigger);
      },
      hintOpen,
      correctionOpen,
      openHint: (trigger) => {
        setState((current) => {
          if (current.kind !== 'ready') return current;
          const attempt = markHintUsed(current.attempt);
          persistAttempt(attempt);
          return { ...current, attempt };
        });
        setHelpTrigger(trigger ?? null);
        setHintOpen(true);
      },
      closeHint: () => {
        setHintOpen(false);
        queueMicrotask(() => helpTrigger?.focus());
      },
      openCorrection: (trigger) => {
        setState((current) => {
          if (current.kind !== 'ready') return current;
          const attempt = markCorrectionViewed(current.attempt);
          persistAttempt(attempt);
          return { ...current, attempt };
        });
        setHintOpen(false);
        setHelpTrigger(trigger ?? null);
        setCorrectionOpen(true);
      },
      closeCorrection: () => {
        setCorrectionOpen(false);
        queueMicrotask(() => helpTrigger?.focus());
      },
      markReflexExceeded: () =>
        setState((current) => {
          if (current.kind !== 'ready' || current.attempt.timeExceeded)
            return current;
          const attempt = markTimeExceeded(current.attempt);
          persistAttempt(attempt);
          return { ...current, attempt };
        }),
      evaluate: async (action) => {
        if (state.kind !== 'ready') return;
        if (mode === 'chapter-test' && chapterTest?.status !== 'active') return;
        const completed = completeQuestionAttempt(state.attempt, {
          id: services.revisionSeedSource.nextSeed(),
          action,
          completedAt: new Date(services.clock.now()).toISOString(),
        });
        if (!completed.evaluation || completed === state.attempt) return;
        await services.evaluationRepository.append(
          completed.evaluation,
          userId,
        );
        await services.questionAttemptRepository.save(
          toQuestionAttemptDraft(completed),
          userId,
        );
        setState((current) =>
          current.kind === 'ready' && current.instance.id === state.instance.id
            ? { ...current, attempt: completed }
            : current,
        );
      },
      chapterTest,
      startChapterTest: async (chapterId, questionCount) => {
        const now = new Date(services.clock.now()).toISOString();
        const sessionId = services.revisionSeedSource.nextSeed();
        const blueprint = createChapterTestBlueprint({
          id: services.revisionSeedSource.nextSeed(),
          userId,
          sessionId,
          chapterId,
          questionCount,
          seed: services.revisionSeedSource.nextSeed(),
          createdAt: now,
          repository: services.questionRepository,
        });
        if (!blueprint) return false;
        const session: ChapterTestSession = {
          blueprint,
          currentIndex: 0,
          status: 'active',
          updatedAt: now,
        };
        await services.chapterTestRepository.save(session, userId);
        board.clearDraft();
        setChapterTest(session);
        const instance = blueprint.orderedQuestionInstances[0];
        if (!instance) return false;
        const content = instantiateQuestionVariant(
          instance.frozenQuestion,
          instance.parameterValues,
        );
        if (!content.ok) return false;
        await loadChapterQuestion(session, 0);
        return true;
      },
      navigateChapterTest: async (index) => {
        if (!chapterTest) return;
        const now = new Date(services.clock.now()).toISOString();
        const moved = moveChapterTest(chapterTest, index, now);
        if (moved === chapterTest) return;
        await services.chapterTestRepository.save(moved, userId);
        board.clearDraft();
        setChapterTest(moved);
        await loadChapterQuestion(moved, index);
      },
      finishChapterTest: async (status) => {
        if (!chapterTest) return;
        const finished = finishChapterTest(
          chapterTest,
          status,
          new Date(services.clock.now()).toISOString(),
        );
        await services.chapterTestRepository.save(finished, userId);
        setChapterTest(finished);
      },
      pendingChange: pending !== null,
      dialogTrigger,
      cancelChange,
      confirmChange,
    }),
    [
      activeFilters,
      board,
      cancelChange,
      confirmChange,
      dialogTrigger,
      correctionOpen,
      chapterTest,
      helpTrigger,
      hintOpen,
      mode,
      notice,
      loadChapterQuestion,
      pending,
      persistAttempt,
      requestFree,
      setMode,
      setFreeFilters,
      state,
      services,
      visibleFilters,
      userId,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useRevisionExperience() {
  const value = useContext(Context);
  if (!value) throw new Error('RevisionExperienceProvider is missing.');
  return value;
}
