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
import type {
  DailyPlanState,
  FreeRevisionFilters,
  SessionMode,
  WeakPointsState,
} from '@domain/session/Session';

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
  setMode(mode: SessionMode, trigger?: HTMLElement): void;
  state: RevisionExperienceState;
  notice: string | null;
  activeFilters: FreeRevisionFilters;
  visibleFilters: FreeRevisionFilters;
  setVisibleFilters(filters: FreeRevisionFilters): void;
  applyFilters(trigger?: HTMLElement): void;
  nextQuestion(trigger?: HTMLElement): void;
  pendingChange: boolean;
  dialogTrigger: HTMLElement | null;
  cancelChange(): void;
  confirmChange(): void;
}

const Context = createContext<RevisionExperienceValue | null>(null);

export function RevisionExperienceProvider({
  children,
}: {
  children: ReactNode;
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
  const [dialogTrigger, setDialogTrigger] = useState<HTMLElement | null>(null);
  const request = useRef(0);
  const initialLoaded = useRef(false);
  const mounted = useRef(true);

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
      if (clearDraft) board.clearDraft();
      setModeState('free');
      setActiveFilters(filters);
      setVisibleFilters(filters);
      setNotice(null);
      setState({
        kind: 'ready',
        prepared,
        question,
        reflexDeadline:
          question.type === 'reflex' ? services.clock.now() + 60_000 : null,
      });
      return true;
    },
    [board, services, showAttemptFailure, state],
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
        return;
      }
      setState({ kind: 'loading' });
      const source =
        next === 'daily'
          ? services.dailyPlanStateRepository.getState()
          : services.weakPointsStateRepository.getState();
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
    [activeFilters, attemptFree, board, services],
  );

  const requestFree = useCallback(
    (
      filters: FreeRevisionFilters,
      excludeCurrent: boolean,
      trigger?: HTMLElement,
    ) => {
      if (board.hasDraft) {
        setDialogTrigger(trigger ?? null);
        setPending({ kind: 'free', filters, excludeCurrent });
      } else attemptFree(filters, excludeCurrent);
    },
    [attemptFree, board.hasDraft],
  );

  const setMode = useCallback(
    (next: SessionMode, trigger?: HTMLElement) => {
      if (next === mode) return;
      if (board.hasDraft && state.kind === 'ready') {
        setDialogTrigger(trigger ?? null);
        setPending({ kind: 'mode', mode: next });
        return;
      }
      enterMode(next);
    },
    [board.hasDraft, enterMode, mode, state],
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
      setVisibleFilters,
      applyFilters: (trigger) => requestFree(visibleFilters, false, trigger),
      nextQuestion: (trigger) => requestFree(activeFilters, true, trigger),
      pendingChange: pending !== null,
      dialogTrigger,
      cancelChange,
      confirmChange,
    }),
    [
      activeFilters,
      cancelChange,
      confirmChange,
      dialogTrigger,
      mode,
      notice,
      pending,
      requestFree,
      setMode,
      state,
      visibleFilters,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useRevisionExperience() {
  const value = useContext(Context);
  if (!value) throw new Error('RevisionExperienceProvider is missing.');
  return value;
}
