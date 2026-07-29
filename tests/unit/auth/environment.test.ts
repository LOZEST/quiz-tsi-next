import { AuthError } from '@domain/auth/AuthError';
import { ControlledAuthGateway } from '@infrastructure/auth/ControlledAuthGateway';
import { readSupabaseEnvironment } from '@infrastructure/supabase/environment';

describe('authentication environment', () => {
  it('accepts a valid public Supabase environment', () => {
    expect(
      readSupabaseEnvironment({
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_ANON_KEY: 'a'.repeat(24),
      }),
    ).toEqual({
      url: 'http://127.0.0.1:54321',
      anonKey: 'a'.repeat(24),
    });
  });

  it.each([
    {},
    {
      VITE_SUPABASE_URL: 'file:///tmp/database',
      VITE_SUPABASE_ANON_KEY: 'a'.repeat(24),
    },
    {
      VITE_SUPABASE_URL: 'not-a-url',
      VITE_SUPABASE_ANON_KEY: 'short',
    },
  ])('rejects missing or invalid configuration', (environment) => {
    expect(() => readSupabaseEnvironment(environment)).toThrowError(AuthError);
  });
});

describe('controlled browser-test gateway', () => {
  it('rejects failures, restores a session and signs out without storing passwords', async () => {
    const gateway = new ControlledAuthGateway();
    await expect(
      gateway.signInWithPassword('user@example.test', 'wrong'),
    ).rejects.toMatchObject({ code: 'invalid-credentials' });
    await expect(
      gateway.signInWithPassword('user@example.test', 'network-unavailable'),
    ).rejects.toMatchObject({ code: 'network-unavailable' });
    await expect(
      gateway.signInWithPassword('admin@example.test', 'test-password'),
    ).resolves.toMatchObject({ user: { role: 'admin' } });
    expect(sessionStorage.getItem('qtsi-controlled-auth-session')).toBe(
      'admin@example.test',
    );
    await expect(gateway.getCurrentSession()).resolves.toMatchObject({
      user: { role: 'admin' },
    });
    await gateway.signOut();
    await expect(gateway.getCurrentSession()).resolves.toBeNull();
  });

  it('provides a harmless subscription boundary', () => {
    const unsubscribe = new ControlledAuthGateway().subscribeToAuthChanges(
      vi.fn(),
    );
    expect(unsubscribe()).toBeUndefined();
  });
});
