/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { AuthError } from '@domain/auth/AuthError';
import type { AuthSession } from '@domain/auth/AuthSession';
import {
  authReducer,
  initialAuthState,
} from '@features/auth/state/authReducer';
import type { AuthState } from '@features/auth/state/AuthState';
import { useAppServices } from './AppServicesProvider';

interface AuthContextValue {
  state: AuthState;
  signIn(email: string, password: string): Promise<boolean>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeError(error: unknown): AuthError {
  return error instanceof AuthError
    ? error
    : new AuthError('unknown', 'Unexpected authentication error.', {
        cause: error,
      });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { authGateway, workspaceRepository } = useAppServices();
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const generation = useRef(0);
  const operation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const activateSession = useCallback(
    async (
      session: AuthSession,
      activeGeneration: number,
      activeOperation: number,
    ) => {
      await workspaceRepository.open(session.user.id, activeGeneration);
      if (
        generation.current !== activeGeneration ||
        !workspaceRepository.isGenerationActive(
          activeGeneration,
          session.user.id,
        )
      ) {
        return;
      }
      await workspaceRepository.cacheValidatedProfile(
        session.user,
        activeGeneration,
      );
      dispatch({
        type: 'AUTHENTICATE_SUCCESS',
        generation: activeGeneration,
        operationId: activeOperation,
        session,
      });
    },
    [workspaceRepository],
  );

  const transitionToSession = useCallback(
    async (session: AuthSession): Promise<boolean> => {
      controller.current?.abort();
      const activeGeneration = ++generation.current;
      const activeOperation = ++operation.current;
      const abortController = new AbortController();
      controller.current = abortController;
      dispatch({
        type: 'AUTHENTICATE_START',
        generation: activeGeneration,
        operationId: activeOperation,
      });
      try {
        await workspaceRepository.close();
        if (generation.current !== activeGeneration) return false;
        await activateSession(session, activeGeneration, activeOperation);
        return generation.current === activeGeneration;
      } catch (error) {
        if (
          abortController.signal.aborted ||
          generation.current !== activeGeneration
        ) {
          return false;
        }
        await workspaceRepository.close();
        dispatch({
          type: 'AUTHENTICATE_FAILURE',
          generation: activeGeneration,
          operationId: activeOperation,
          error: normalizeError(error),
        });
        return false;
      }
    },
    [activateSession, workspaceRepository],
  );

  useEffect(() => {
    const activeGeneration = generation.current;
    const activeOperation = operation.current;
    const abortController = new AbortController();
    controller.current = abortController;

    void authGateway
      .getCurrentSession(abortController.signal)
      .then(async (session) => {
        if (generation.current !== activeGeneration) return;
        if (!session) {
          dispatch({
            type: 'RESTORE_EMPTY',
            generation: activeGeneration,
            operationId: activeOperation,
          });
          return;
        }
        await activateSession(session, activeGeneration, activeOperation);
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return;
        const authError = normalizeError(error);
        const candidate = authError.offlineCandidate;
        if (
          authError.code === 'network-unavailable' &&
          candidate &&
          (!candidate.expiresAt ||
            new Date(candidate.expiresAt).getTime() > Date.now())
        ) {
          void workspaceRepository
            .getCachedProfile(candidate.userId)
            .then(async (profile) => {
              if (!profile || generation.current !== activeGeneration) {
                throw authError;
              }
              const offlineSession: AuthSession = {
                user: profile,
                ...(candidate.expiresAt
                  ? { expiresAt: candidate.expiresAt }
                  : {}),
                validity: 'offline-unverified',
                workspaceGeneration: activeGeneration,
              };
              await workspaceRepository.open(
                candidate.userId,
                activeGeneration,
              );
              dispatch({
                type: 'AUTHENTICATE_SUCCESS',
                generation: activeGeneration,
                operationId: activeOperation,
                session: offlineSession,
                offline: true,
              });
            })
            .catch(() => {
              dispatch({
                type: 'AUTHENTICATE_FAILURE',
                generation: activeGeneration,
                operationId: activeOperation,
                error: authError,
              });
            });
          return;
        }
        dispatch({
          type: 'AUTHENTICATE_FAILURE',
          generation: activeGeneration,
          operationId: activeOperation,
          error: authError,
        });
      });

    const unsubscribe = authGateway.subscribeToAuthChanges(
      (session) => {
        if (session) {
          void transitionToSession(session);
          return;
        }
        const nextGeneration = ++generation.current;
        controller.current?.abort();
        void workspaceRepository.close().then(() => {
          if (generation.current === nextGeneration) {
            dispatch({
              type: 'SESSION_INVALIDATED',
              generation: nextGeneration,
            });
          }
        });
      },
      (error) => {
        controller.current?.abort();
        const activeGeneration = ++generation.current;
        const activeOperation = ++operation.current;
        dispatch({
          type: 'AUTHENTICATE_START',
          generation: activeGeneration,
          operationId: activeOperation,
        });
        void workspaceRepository.close().then(() => {
          if (generation.current === activeGeneration) {
            dispatch({
              type: 'AUTHENTICATE_FAILURE',
              generation: activeGeneration,
              operationId: activeOperation,
              error: normalizeError(error),
            });
          }
        });
      },
    );

    return () => {
      abortController.abort();
      unsubscribe();
      void workspaceRepository.close();
    };
  }, [activateSession, authGateway, transitionToSession, workspaceRepository]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      controller.current?.abort();
      await workspaceRepository.close();
      const activeGeneration = ++generation.current;
      const activeOperation = ++operation.current;
      const abortController = new AbortController();
      controller.current = abortController;
      dispatch({
        type: 'AUTHENTICATE_START',
        generation: activeGeneration,
        operationId: activeOperation,
      });
      try {
        const session = await authGateway.signInWithPassword(
          email,
          password,
          abortController.signal,
        );
        if (generation.current !== activeGeneration) return false;
        await activateSession(session, activeGeneration, activeOperation);
        return generation.current === activeGeneration;
      } catch (error) {
        if (abortController.signal.aborted) return false;
        dispatch({
          type: 'AUTHENTICATE_FAILURE',
          generation: activeGeneration,
          operationId: activeOperation,
          error: normalizeError(error),
        });
        return false;
      }
    },
    [activateSession, authGateway, workspaceRepository],
  );

  const signOut = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (current.status !== 'authenticated') return;
    controller.current?.abort();
    const activeGeneration = ++generation.current;
    const activeOperation = ++operation.current;
    dispatch({
      type: 'SIGN_OUT_START',
      generation: activeGeneration,
      operationId: activeOperation,
      session: current.session,
    });
    let error: AuthError | undefined;
    try {
      await workspaceRepository.close();
      await authGateway.signOut();
    } catch (caught) {
      error = normalizeError(caught);
    }
    dispatch({
      type: 'SIGN_OUT_COMPLETE',
      generation: activeGeneration,
      operationId: activeOperation,
      ...(error ? { error } : {}),
    });
  }, [authGateway, workspaceRepository]);

  const value = useMemo(
    () => ({ state, signIn, signOut }),
    [signIn, signOut, state],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is missing.');
  return context;
}
