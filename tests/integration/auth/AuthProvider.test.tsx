import { act, render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '@app/providers/AuthProvider';
import {
  AppServicesProvider,
  type AppServices,
} from '@app/providers/AppServicesProvider';
import type { AuthGateway } from '@domain/auth/AuthGateway';
import { AuthError } from '@domain/auth/AuthError';
import type { AuthSession } from '@domain/auth/AuthSession';
import type { WorkspaceRepository } from '@domain/workspace/WorkspaceRepository';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function Harness() {
  const auth = useAuth();
  return (
    <>
      <output>
        {auth.state.status === 'authenticated'
          ? auth.state.session.user.email
          : `${auth.state.status}${
              'error' in auth.state ? `:${auth.state.error.code}` : ''
            }`}
      </output>
      <button onClick={() => void auth.signIn('a@example.test', 'password')}>
        A
      </button>
      <button onClick={() => void auth.signIn('b@example.test', 'password')}>
        B
      </button>
    </>
  );
}

describe('AuthProvider concurrency', () => {
  it('ignores a late response from the previous account generation', async () => {
    const requestA = deferred<AuthSession>();
    const requestB = deferred<AuthSession>();
    const gateway: AuthGateway = {
      getCurrentSession: vi.fn().mockResolvedValue(null),
      signInWithPassword: vi
        .fn()
        .mockReturnValueOnce(requestA.promise)
        .mockReturnValueOnce(requestB.promise),
      signOut: vi.fn().mockResolvedValue(undefined),
      subscribeToAuthChanges: vi.fn().mockReturnValue(() => undefined),
    };
    let active: { userId: string; generation: number } | null = null;
    const workspace: WorkspaceRepository = {
      open: vi.fn().mockImplementation((userId: string, generation: number) => {
        active = { userId, generation };
        return Promise.resolve({
          userId,
          workspaceGeneration: generation,
          schemaVersion: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        });
      }),
      cacheValidatedProfile: vi.fn().mockResolvedValue(undefined),
      getCachedProfile: vi.fn().mockResolvedValue(null),
      close: vi.fn().mockImplementation(() => {
        active = null;
        return Promise.resolve();
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      isGenerationActive: vi
        .fn()
        .mockImplementation(
          (generation: number, userId: string) =>
            active?.generation === generation && active.userId === userId,
        ),
    };
    const services: AppServices = {
      authGateway: gateway,
      workspaceRepository: workspace,
    };
    render(
      <AppServicesProvider services={services}>
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </AppServicesProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'A' }).click();
      await Promise.resolve();
      screen.getByRole('button', { name: 'B' }).click();
      requestB.resolve({
        user: { id: 'b', email: 'b@example.test', role: 'owner' },
        validity: 'valid',
        workspaceGeneration: 0,
      });
      await requestB.promise;
    });
    expect(await screen.findByText('b@example.test')).toBeInTheDocument();

    await act(async () => {
      requestA.resolve({
        user: { id: 'a', email: 'a@example.test', role: 'user' },
        validity: 'valid',
        workspaceGeneration: 0,
      });
      await requestA.promise;
    });
    expect(screen.getByText('b@example.test')).toBeInTheDocument();
    expect(screen.queryByText('a@example.test')).toBeNull();
  });

  it('restores a cached validated profile offline without trusting it for a new session', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const gateway: AuthGateway = {
      getCurrentSession: vi.fn().mockRejectedValue(
        new AuthError('network-unavailable', 'offline', undefined, {
          userId: 'offline-user',
          email: 'offline@example.test',
          expiresAt,
        }),
      ),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined),
      subscribeToAuthChanges: vi.fn().mockReturnValue(() => undefined),
    };
    const workspace: WorkspaceRepository = {
      open: vi.fn().mockImplementation((userId: string, generation: number) =>
        Promise.resolve({
          userId,
          workspaceGeneration: generation,
          schemaVersion: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        }),
      ),
      cacheValidatedProfile: vi.fn().mockResolvedValue(undefined),
      getCachedProfile: vi.fn().mockResolvedValue({
        id: 'offline-user',
        email: 'offline@example.test',
        role: 'user',
      }),
      close: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      isGenerationActive: vi.fn().mockReturnValue(true),
    };
    render(
      <AppServicesProvider
        services={{ authGateway: gateway, workspaceRepository: workspace }}
      >
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </AppServicesProvider>,
    );
    expect(await screen.findByText('offline@example.test')).toBeInTheDocument();
  });

  it('activates non-null auth events and replaces the previous workspace', async () => {
    let emit: ((session: AuthSession | null) => void) | undefined;
    const gateway: AuthGateway = {
      getCurrentSession: vi.fn().mockResolvedValue(null),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined),
      subscribeToAuthChanges: vi
        .fn()
        .mockImplementation(
          (handler: (session: AuthSession | null) => void) => {
            emit = handler;
            return () => undefined;
          },
        ),
    };
    let active: { userId: string; generation: number } | null = null;
    const workspace: WorkspaceRepository = {
      open: vi.fn().mockImplementation((userId: string, generation: number) => {
        active = { userId, generation };
        return Promise.resolve({
          userId,
          workspaceGeneration: generation,
          schemaVersion: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        });
      }),
      cacheValidatedProfile: vi.fn().mockResolvedValue(undefined),
      getCachedProfile: vi.fn().mockResolvedValue(null),
      close: vi.fn().mockImplementation(() => {
        active = null;
        return Promise.resolve();
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      isGenerationActive: vi
        .fn()
        .mockImplementation(
          (generation: number, userId: string) =>
            active?.generation === generation && active.userId === userId,
        ),
    };
    render(
      <AppServicesProvider
        services={{ authGateway: gateway, workspaceRepository: workspace }}
      >
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </AppServicesProvider>,
    );
    await screen.findByText('unauthenticated');

    act(() => {
      emit?.({
        user: { id: 'a', email: 'a@example.test', role: 'user' },
        validity: 'valid',
        workspaceGeneration: 0,
      });
    });
    expect(await screen.findByText('a@example.test')).toBeInTheDocument();

    act(() => {
      emit?.({
        user: { id: 'b', email: 'b@example.test', role: 'owner' },
        validity: 'valid',
        workspaceGeneration: 0,
      });
    });
    expect(await screen.findByText('b@example.test')).toBeInTheDocument();
    // Vitest mocks implement the injected repository methods.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(workspace.close).toHaveBeenCalled();
    // Vitest mocks implement the injected repository methods.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(workspace.cacheValidatedProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'b' }),
      expect.any(Number),
    );

    act(() => {
      emit?.(null);
    });
    expect(await screen.findByText('unauthenticated')).toBeInTheDocument();
  });

  it('surfaces auth-event profile and network failures after closing private state', async () => {
    let fail: ((error: unknown) => void) | undefined;
    const gateway: AuthGateway = {
      getCurrentSession: vi.fn().mockResolvedValue(null),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined),
      subscribeToAuthChanges: vi
        .fn()
        .mockImplementation(
          (
            _handler: (session: AuthSession | null) => void,
            onError?: (error: unknown) => void,
          ) => {
            fail = onError;
            return () => undefined;
          },
        ),
    };
    const workspace: WorkspaceRepository = {
      open: vi.fn(),
      cacheValidatedProfile: vi.fn(),
      getCachedProfile: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      isGenerationActive: vi.fn().mockReturnValue(false),
    };
    render(
      <AppServicesProvider
        services={{ authGateway: gateway, workspaceRepository: workspace }}
      >
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </AppServicesProvider>,
    );
    await screen.findByText('unauthenticated');

    act(() => fail?.(new AuthError('profile-missing', 'missing')));
    expect(
      await screen.findByText('unauthenticated:profile-missing'),
    ).toBeInTheDocument();
    act(() => fail?.(new AuthError('network-unavailable', 'offline')));
    expect(
      await screen.findByText('unauthenticated:network-unavailable'),
    ).toBeInTheDocument();
    // Vitest mocks implement the injected repository methods.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(workspace.close).toHaveBeenCalledTimes(2);
  });

  it('does not duplicate activation when SIGNED_IN supersedes signInWithPassword', async () => {
    const signedIn = deferred<AuthSession>();
    let emit: ((session: AuthSession | null) => void) | undefined;
    const session: AuthSession = {
      user: { id: 'a', email: 'a@example.test', role: 'user' },
      validity: 'valid',
      workspaceGeneration: 0,
    };
    const gateway: AuthGateway = {
      getCurrentSession: vi.fn().mockResolvedValue(null),
      signInWithPassword: vi.fn().mockReturnValue(signedIn.promise),
      signOut: vi.fn().mockResolvedValue(undefined),
      subscribeToAuthChanges: vi
        .fn()
        .mockImplementation(
          (handler: (session: AuthSession | null) => void) => {
            emit = handler;
            return () => undefined;
          },
        ),
    };
    let active: { userId: string; generation: number } | null = null;
    const workspace: WorkspaceRepository = {
      open: vi.fn().mockImplementation((userId: string, generation: number) => {
        active = { userId, generation };
        return Promise.resolve({
          userId,
          workspaceGeneration: generation,
          schemaVersion: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        });
      }),
      cacheValidatedProfile: vi.fn().mockResolvedValue(undefined),
      getCachedProfile: vi.fn(),
      close: vi.fn().mockImplementation(() => {
        active = null;
        return Promise.resolve();
      }),
      delete: vi.fn(),
      isGenerationActive: vi
        .fn()
        .mockImplementation(
          (generation: number, userId: string) =>
            active?.generation === generation && active.userId === userId,
        ),
    };
    render(
      <AppServicesProvider
        services={{ authGateway: gateway, workspaceRepository: workspace }}
      >
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </AppServicesProvider>,
    );
    await screen.findByText('unauthenticated');
    act(() => {
      screen.getByRole('button', { name: 'A' }).click();
      emit?.(session);
      signedIn.resolve(session);
    });
    expect(await screen.findByText('a@example.test')).toBeInTheDocument();
    // Vitest mocks implement the injected repository methods.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(workspace.open).toHaveBeenCalledOnce();
  });

  it('closes private state when an auth-event workspace cannot be opened', async () => {
    let emit: ((session: AuthSession | null) => void) | undefined;
    const gateway: AuthGateway = {
      getCurrentSession: vi.fn().mockResolvedValue(null),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined),
      subscribeToAuthChanges: vi
        .fn()
        .mockImplementation(
          (handler: (session: AuthSession | null) => void) => {
            emit = handler;
            return () => undefined;
          },
        ),
    };
    const workspace: WorkspaceRepository = {
      open: vi
        .fn()
        .mockRejectedValue(
          new AuthError('storage-unavailable', 'storage failed'),
        ),
      cacheValidatedProfile: vi.fn(),
      getCachedProfile: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      isGenerationActive: vi.fn().mockReturnValue(false),
    };
    render(
      <AppServicesProvider
        services={{ authGateway: gateway, workspaceRepository: workspace }}
      >
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </AppServicesProvider>,
    );
    await screen.findByText('unauthenticated');
    act(() => {
      emit?.({
        user: { id: 'a', email: 'a@example.test', role: 'user' },
        validity: 'valid',
        workspaceGeneration: 0,
      });
    });
    expect(
      await screen.findByText('unauthenticated:storage-unavailable'),
    ).toBeInTheDocument();
    // Vitest mocks implement the injected repository methods.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(workspace.close).toHaveBeenCalledTimes(2);
  });
});
