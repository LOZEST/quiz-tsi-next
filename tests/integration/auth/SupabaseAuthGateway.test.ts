import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAuthGateway } from '@infrastructure/auth/SupabaseAuthGateway';

const rawSession = {
  user: { id: 'account-a', email: 'a@example.test' },
  expires_at: 2_000_000_000,
} as Session;

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

  it('maps refreshed sessions and closes subscriptions', async () => {
    const controlled = createClient();
    const handler = vi.fn();
    const unsubscribe = new SupabaseAuthGateway(
      controlled.client,
    ).subscribeToAuthChanges(handler);
    controlled.emit('TOKEN_REFRESHED', rawSession);
    await vi.waitFor(() =>
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ validity: 'valid' }),
      ),
    );
    controlled.emit('OTHER', null);
    expect(handler).toHaveBeenCalledWith(null);
    unsubscribe();
  });
});
