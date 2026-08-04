/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
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

export type RevisionExperienceState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'no-program'; message: string }
  | { kind: 'no-bank'; message: string }
  | { kind: 'ready'; prepared: PreparedQuestion; question: Readonly<Question> }
  | { kind: 'no-match'; message: string }
  | { kind: 'daily'; state: DailyPlanState }
  | { kind: 'weak-points'; state: WeakPointsState }
  | { kind: 'chapter-test' }
  | { kind: 'error'; code: string; message: string };

interface RevisionExperienceValue {
  mode: SessionMode;
  setMode(mode: SessionMode): void;
  state: RevisionExperienceState;
  activeFilters: FreeRevisionFilters;
  visibleFilters: FreeRevisionFilters;
  setVisibleFilters(filters: FreeRevisionFilters): void;
  applyFilters(): void;
  nextQuestion(): void;
  pendingChange: boolean;
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
  const [state, setState] = useState<RevisionExperienceState>(() =>
    services.questionRepository.getBankMetadata()
      ? services.programIndex
        ? { kind: 'idle' }
        : {
            kind: 'no-program',
            message: 'Le programme est indisponible pour le moment.',
          }
      : {
          kind: 'no-bank',
          message:
            'Aucune banque de questions validée n’est disponible pour le moment.',
        },
  );
  const [activeFilters, setActiveFilters] = useState(
    initialFreeRevisionFilters,
  );
  const [visibleFilters, setVisibleFilters] = useState(
    initialFreeRevisionFilters,
  );
  const [pending, setPending] = useState<null | {
    filters: FreeRevisionFilters;
    excludeCurrent: boolean;
  }>(null);
  const request = useRef(0);

  const loadFree = useCallback(
    (
      filters: FreeRevisionFilters,
      excludeCurrent = false,
      clearDraft = false,
    ) => {
      const program = services.programIndex;
      if (!program) {
        setState({
          kind: 'no-program',
          message: 'Le programme est indisponible pour le moment.',
        });
        return false;
      }
      const currentId = state.kind === 'ready' ? state.question.id : null;
      const result = selectFreeRevisionQuestions(
        services.questionRepository,
        filters,
        services.revisionSeedSource.nextSeed(),
        1,
        excludeCurrent && currentId ? [currentId] : [],
      );
      if (result.kind === 'ready') {
        const prepared = result.items[0];
        const question =
          prepared &&
          services.questionRepository.getByIdAndVersion(
            prepared.questionId,
            prepared.questionVersion,
          );
        if (!prepared || !question) {
          setState({
            kind: 'error',
            code: 'question-missing',
            message: 'La question préparée est indisponible.',
          });
          return false;
        }
        if (clearDraft) board.clearDraft();
        setActiveFilters(filters);
        setVisibleFilters(filters);
        setState({ kind: 'ready', prepared, question });
        return true;
      }
      if (result.kind === 'no-bank')
        setState({ kind: 'no-bank', message: result.message });
      else if (
        result.kind === 'no-match' ||
        result.kind === 'insufficient-stock'
      )
        setState({
          kind: 'no-match',
          message:
            excludeCurrent && result.kind === 'no-match'
              ? 'Aucune autre question compatible n’est disponible.'
              : result.message,
        });
      else
        setState({ kind: 'error', code: result.code, message: result.message });
      return false;
    },
    [board, services, state],
  );

  const requestChange = useCallback(
    (filters: FreeRevisionFilters, excludeCurrent = false) => {
      if (board.hasDraft) setPending({ filters, excludeCurrent });
      else loadFree(filters, excludeCurrent);
    },
    [board.hasDraft, loadFree],
  );

  const setMode = useCallback(
    (next: SessionMode) => {
      setModeState(next);
      setPending(null);
      const id = ++request.current;
      if (next === 'free') {
        loadFree(activeFilters);
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
          if (id !== request.current) return;
          setState(
            next === 'daily'
              ? { kind: 'daily', state: value as DailyPlanState }
              : { kind: 'weak-points', state: value as WeakPointsState },
          );
        })
        .catch(() => {
          if (id === request.current)
            setState({
              kind: 'error',
              code: 'state-unavailable',
              message: 'Ces données sont indisponibles pour le moment.',
            });
        });
    },
    [activeFilters, loadFree, services],
  );

  const value = useMemo<RevisionExperienceValue>(
    () => ({
      mode,
      setMode,
      state,
      activeFilters,
      visibleFilters,
      setVisibleFilters,
      applyFilters: () => requestChange(visibleFilters),
      nextQuestion: () => requestChange(activeFilters, true),
      pendingChange: pending !== null,
      cancelChange: () => {
        setPending(null);
        setVisibleFilters(activeFilters);
      },
      confirmChange: () => {
        if (pending && loadFree(pending.filters, pending.excludeCurrent, true))
          setPending(null);
      },
    }),
    [
      activeFilters,
      loadFree,
      mode,
      pending,
      requestChange,
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
