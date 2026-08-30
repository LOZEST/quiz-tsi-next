import type { QuestionRemoteGateway } from '@domain/repositories/QuestionRemoteGateway';
import type { QuestionWorkspaceRepository } from '@domain/repositories/QuestionWorkspaceRepository';
import { syncQuestionWorkspace } from './syncQuestionWorkspace';

export type QuestionWorkspaceSyncOutcome =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; error: Error }>;

export interface QuestionWorkspaceSyncCoordinator {
  requestSync(userId: string): Promise<QuestionWorkspaceSyncOutcome>;
}

/**
 * Coalesces every sync trigger (page mount, manual "Synchroniser" button,
 * a post-mutation nudge, the periodic background timer, a reconnect event)
 * into a single in-flight run per app session. A request that arrives while
 * one is already running queues at most one more (not one per request), so
 * whatever changed mid-run still gets pushed without stacking unbounded
 * parallel syncs against the same outbox.
 */
export function createQuestionWorkspaceSyncCoordinator(
  local: QuestionWorkspaceRepository,
  remote: QuestionRemoteGateway,
  afterSync: (userId: string) => Promise<void>,
): QuestionWorkspaceSyncCoordinator {
  let inFlight: Promise<QuestionWorkspaceSyncOutcome> | null = null;
  let queuedUserId: string | null = null;

  const run = (userId: string): Promise<QuestionWorkspaceSyncOutcome> => {
    const attempt = (async (): Promise<QuestionWorkspaceSyncOutcome> => {
      try {
        await syncQuestionWorkspace(userId, local, remote);
        await afterSync(userId);
        return { ok: true as const };
      } catch (reason) {
        return {
          ok: false as const,
          error:
            reason instanceof Error
              ? reason
              : new Error('Synchronisation impossible.'),
        };
      }
    })();
    inFlight = attempt.finally(() => {
      inFlight = null;
      if (queuedUserId !== null) {
        const next = queuedUserId;
        queuedUserId = null;
        void run(next);
      }
    });
    return inFlight;
  };

  return {
    requestSync(userId: string) {
      if (inFlight) {
        queuedUserId = userId;
        return inFlight;
      }
      return run(userId);
    },
  };
}
