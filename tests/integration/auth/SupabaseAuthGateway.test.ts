import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAuthGateway } from '@infrastructure/auth/SupabaseAuthGateway';

const rawSession = {
  user: { id: 'account-a', email: 'a@example.test' },
  expires_at: 2_000_000_000,
} as Session;
const rawSessionB = {
  user: { id: 'account-b', email: 'b@example.test' },
  expires_at: 2_000_000_000,
} as Session;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createClient(options?: {
  session?: Session | null;
  profile?: unknown;
  profileError?: { code?: string; message: string } | null;
  signInError?: Error | null;
}) {
  let authHandler: ((event: string, session: Session | null) => void) | null =
    null;
  const single = vi.fn().mockResolvedValue({
    data:
      options?.profile ??
      ({
        user_id: 'account-a',
        email: 'a@example.test',
        display_name: 'Ada',
        role: 'user',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      } as const),
    error: options?.profileError ?? null,
  });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single,
  };
  const unsubscribe = vi.fn();
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session:
            options && 'session' in options ? options.session : rawSession,
        },
        error: null,
      }),
      signInWithPassword: options?.signInError
        ? vi.fn().mockResolvedValue({
            data: { session: null },
            error: options.signInError,
          })
        : vi.fn().mockResolvedValue({
            data: { session: rawSession },
            error: null,
          }),
      signUp: vi.fn().mockResolvedValue({
        data: {
          user: { id: 'account-a', identities: [{ id: 'identity-a' }] },
          session: rawSession,
        },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockImplementation((handler) => {
        authHandler = handler as typeof authHandler;
        return { data: { subscription: { unsubscribe } } };
      }),
    },
    from: vi.fn().mockReturnValue(query),
  };
  return {
    client: client as unknown as SupabaseClient,
    emit(event: string, session: Session | null) {
      authHandler?.(event, session);
    },
    unsubscribe,
    single,
  };
}

describe('SupabaseAuthGateway', () => {
  it('restores a session and maps its validated profile', async () => {
    const { client } = createClient();
    await expect(
      new SupabaseAuthGateway(client).getCurrentSession(),
    ).resolves.toMatchObject({
      user: { id: 'account-a', role: 'user', displayName: 'Ada' },
      validity: 'valid',
    });
  });

  it('returns null when the SDK has no session', async () => {
    const { client } = createClient({ session: null });
    await expect(
      new SupabaseAuthGateway(client).getCurrentSession(),
    ).resolves.toBeNull();
  });

  it('translates credentials and missing profiles', async () => {
    const credentials = createClient({
      signInError: new Error('Invalid login credentials'),
    });
    await expect(
      new SupabaseAuthGateway(credentials.client).signInWithPassword(
        'a@example.test',
        'wrong',
      ),
    ).rejects.toMatchObject({ code: 'invalid-credentials' });

    const missing = createClient({
      profileError: { code: 'PGRST116', message: 'no rows' },
    });
    await expect(
      new SupabaseAuthGateway(missing.client).getCurrentSession(),
    ).rejects.toMatchObject({ code: 'profile-missing' });
  });

  it('translates a sign-in attempt before email confirmation', async () => {
    const unconfirmed = createClient({
      signInError: new Error('Email not confirmed'),
    });
    await expect(
      new SupabaseAuthGateway(unconfirmed.client).signInWithPassword(
        'a@example.test',
        'secret1',
      ),
    ).rejects.toMatchObject({ code: 'email-not-confirmed' });
  });

  it('signs up and maps the created session', async () => {
    const { client } = createClient();
    await expect(
      new SupabaseAuthGateway(client).signUp('a@example.test', 'secret1'),
    ).resolves.toMatchObject({
      status: 'signed-in',
      session: { user: { id: 'account-a', role: 'user' } },
    });
    expect(
      // The test client is a Vitest mock behind the Supabase SDK shape.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      client.auth.signUp,
    ).toHaveBeenCalledWith({
      email: 'a@example.test',
      password: 'secret1',
      options: { emailRedirectTo: 'http://localhost:3000/login' },
    });
  });

  it('reports confirmation-required when sign-up returns no session', async () => {
    const { client } = createClient();
    (
      client.auth.signUp as unknown as {
        mockResolvedValue: (v: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        user: { id: 'account-a', identities: [{ id: 'identity-a' }] },
        session: null,
      },
      error: null,
    });
    await expect(
      new SupabaseAuthGateway(client).signUp('a@example.test', 'secret1'),
    ).resolves.toEqual({ status: 'confirmation-required' });
  });

  it('rejects sign-up for an email that is already registered', async () => {
    const { client } = createClient();
    (
      client.auth.signUp as unknown as {
        mockResolvedValue: (v: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: { id: 'account-a', identities: [] }, session: null },
      error: null,
    });
    await expect(
      new SupabaseAuthGateway(client).signUp('a@example.test', 'secret1'),
    ).rejects.toMatchObject({ code: 'email-already-registered' });
  });

  it('maps a rejected sign-up error', async () => {
    const { client } = createClient();
    (
      client.auth.signUp as unknown as {
        mockResolvedValue: (v: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('Password should be at least 6 characters.'),
    });
    await expect(
      new SupabaseAuthGateway(client).signUp('a@example.test', '1'),
    ).rejects.toMatchObject({ code: 'weak-password' });
  });

  it('maps a rate-limited sign-up attempt', async () => {
    const { client } = createClient();
    (
      client.auth.signUp as unknown as {
        mockResolvedValue: (v: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: null, session: null },
      error: new Error(
        'For security purposes, you can only request this after 46 seconds.',
      ),
    });
    await expect(
      new SupabaseAuthGateway(client).signUp('a@example.test', 'secret1'),
    ).rejects.toMatchObject({ code: 'rate-limited' });
  });

  it('subscribes to sign-out events and unsubscribes', () => {
    const controlled = createClient();
    const handler = vi.fn();
    const unsubscribe = new SupabaseAuthGateway(
      controlled.client,
    ).subscribeToAuthChanges(handler);
    controlled.emit('SIGNED_OUT', null);
    expect(handler).toHaveBeenCalledWith(null);
    unsubscribe();
    expect(controlled.unsubscribe).toHaveBeenCalledOnce();
  });

  it('attaches a safe offline candidate when profile revalidation loses network', async () => {
    const { client } = createClient({
      profileError: { message: 'Failed to fetch' },
    });
    await expect(
      new SupabaseAuthGateway(client).getCurrentSession(),
    ).rejects.toMatchObject({
      code: 'network-unavailable',
      offlineCandidate: {
        userId: 'account-a',
        email: 'a@example.test',
      },
    });
  });

  it.each(['SIGNED_IN', 'TOKEN_REFRESHED'])(
    'maps %s sessions and closes subscriptions',
    async (event) => {
      const controlled = createClient();
      const handler = vi.fn();
      const unsubscribe = new SupabaseAuthGateway(
        controlled.client,
      ).subscribeToAuthChanges(handler);
      controlled.emit(event, rawSession);
      await vi.waitFor(() =>
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({ validity: 'valid' }),
        ),
      );
      unsubscribe();
      expect(controlled.unsubscribe).toHaveBeenCalledOnce();
    },
  );

  it('reports profile revalidation failures without treating them as sign-out', async () => {
    const controlled = createClient({
      profileError: { code: 'PGRST116', message: 'no rows' },
    });
    const handler = vi.fn();
    const onError = vi.fn();
    new SupabaseAuthGateway(controlled.client).subscribeToAuthChanges(
      handler,
      onError,
    );
    controlled.emit('SIGNED_IN', rawSession);
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'profile-missing' }),
      ),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores a late profile response from A after B has been activated', async () => {
    const controlled = createClient();
    const profileA = deferred<{
      data: unknown;
      error: null;
    }>();
    const profileB = deferred<{
      data: unknown;
      error: null;
    }>();
    controlled.single
      .mockReset()
      .mockReturnValueOnce(profileA.promise)
      .mockReturnValueOnce(profileB.promise);
    const handler = vi.fn();
    new SupabaseAuthGateway(controlled.client).subscribeToAuthChanges(handler);

    controlled.emit('SIGNED_IN', rawSession);
    controlled.emit('SIGNED_IN', rawSessionB);
    profileB.resolve({
      data: {
        user_id: 'account-b',
        email: 'b@example.test',
        display_name: 'Béatrice',
        role: 'owner',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    });
    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    const activatedSession = handler.mock.calls[0]?.[0] as
      | { user: { id: string } }
      | undefined;
    expect(activatedSession?.user.id).toBe('account-b');
    profileA.resolve({
      data: {
        user_id: 'account-a',
        email: 'a@example.test',
        display_name: 'Ada',
        role: 'user',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    });
    await profileA.promise;
    await Promise.resolve();
    expect(handler).toHaveBeenCalledOnce();
  });
});
