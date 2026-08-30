import { describe, expect, it, vi } from 'vitest';
import { createQuestionWorkspaceSyncCoordinator } from '@features/questions/QuestionWorkspaceSyncCoordinator';
import type { QuestionWorkspaceRepository } from '@domain/repositories/QuestionWorkspaceRepository';
import type { QuestionRemoteGateway } from '@domain/repositories/QuestionRemoteGateway';

type PulledResult = { questions: []; quizzes: []; rejectedRows: [] };

function controllableGateway() {
  const gates: Array<() => void> = [];
  const pullRecent = vi.fn(
    () =>
      new Promise<PulledResult>((resolve) => {
        gates.push(() =>
          resolve({ questions: [], quizzes: [], rejectedRows: [] }),
        );
      }),
  );
  const push = vi.fn(() => Promise.resolve({ kind: 'accepted' as const }));
  return {
    remote: { push, pullRecent } as unknown as QuestionRemoteGateway,
    push,
    pullRecent,
    resolveNext: () => gates.shift()?.(),
  };
}

function fakeLocal(): QuestionWorkspaceRepository {
  return {
    listOutbox: vi.fn(() => Promise.resolve([])),
    completeOperation: vi.fn(() => Promise.resolve()),
    recordConflict: vi.fn(() => Promise.resolve()),
    applyRemoteWorkspace: vi.fn(() => Promise.resolve()),
  } as unknown as QuestionWorkspaceRepository;
}

describe('createQuestionWorkspaceSyncCoordinator', () => {
  it('runs a lone request and calls afterSync on success', async () => {
    const { remote, pullRecent, resolveNext } = controllableGateway();
    const afterSync = vi.fn(() => Promise.resolve());
    const coordinator = createQuestionWorkspaceSyncCoordinator(
      fakeLocal(),
      remote,
      afterSync,
    );
    const result = coordinator.requestSync('user-1');
    await vi.waitFor(() => expect(pullRecent).toHaveBeenCalledTimes(1));
    resolveNext();
    await expect(result).resolves.toEqual({ ok: true });
    expect(afterSync).toHaveBeenCalledWith('user-1');
  });

  it('coalesces requests that arrive while one is already running into the same promise, and runs exactly one follow-up', async () => {
    const { remote, pullRecent, resolveNext } = controllableGateway();
    const afterSync = vi.fn(() => Promise.resolve());
    const coordinator = createQuestionWorkspaceSyncCoordinator(
      fakeLocal(),
      remote,
      afterSync,
    );

    const first = coordinator.requestSync('user-1');
    const second = coordinator.requestSync('user-1');
    const third = coordinator.requestSync('user-1');
    expect(second).toBe(first);
    expect(third).toBe(first);
    await vi.waitFor(() => expect(pullRecent).toHaveBeenCalledTimes(1));

    resolveNext();
    await expect(first).resolves.toEqual({ ok: true });

    // The three coalesced calls above must not have queued three follow-up
    // runs — a single one is enough to pick up whatever changed meanwhile.
    await vi.waitFor(() => expect(pullRecent).toHaveBeenCalledTimes(2));
    resolveNext();
    await vi.waitFor(() => expect(afterSync).toHaveBeenCalledTimes(2));
    expect(pullRecent).toHaveBeenCalledTimes(2);
  });

  it('runs a fresh, uncoalesced request once the previous one has settled', async () => {
    const { remote, pullRecent, resolveNext } = controllableGateway();
    const coordinator = createQuestionWorkspaceSyncCoordinator(
      fakeLocal(),
      remote,
      () => Promise.resolve(),
    );
    const first = coordinator.requestSync('user-1');
    await vi.waitFor(() => expect(pullRecent).toHaveBeenCalledTimes(1));
    resolveNext();
    await first;

    const second = coordinator.requestSync('user-1');
    expect(second).not.toBe(first);
    await vi.waitFor(() => expect(pullRecent).toHaveBeenCalledTimes(2));
    resolveNext();
    await expect(second).resolves.toEqual({ ok: true });
  });

  it('resolves with { ok: false, error } instead of throwing when the sync fails', async () => {
    const remote = {
      push: vi.fn(() => Promise.resolve({ kind: 'accepted' as const })),
      pullRecent: vi.fn(() =>
        Promise.reject(new Error('Réseau indisponible.')),
      ),
    } as unknown as QuestionRemoteGateway;
    const afterSync = vi.fn(() => Promise.resolve());
    const coordinator = createQuestionWorkspaceSyncCoordinator(
      fakeLocal(),
      remote,
      afterSync,
    );
    const outcome = await coordinator.requestSync('user-1');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.message).toBe('Réseau indisponible.');
    expect(afterSync).not.toHaveBeenCalled();
  });
});
