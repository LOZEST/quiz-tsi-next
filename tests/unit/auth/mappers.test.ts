import { AuthError } from '@domain/auth/AuthError';
import {
  mapProfile,
  mapSession,
  mapSupabaseError,
} from '@infrastructure/auth/SupabaseAuthMapper';
import type { Session } from '@supabase/supabase-js';

describe('Supabase auth mappers', () => {
  it('maps a valid profile without leaking infrastructure types', () => {
    expect(
      mapProfile({
        user_id: 'a',
        email: 'a@example.test',
        display_name: 'Ada',
        role: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }),
    ).toMatchObject({
      id: 'a',
      email: 'a@example.test',
      displayName: 'Ada',
      role: 'admin',
    });
  });

  it('rejects missing profiles and unknown roles', () => {
    expect(() => mapProfile(null)).toThrowError(AuthError);
    expect(() =>
      mapProfile({
        user_id: 'a',
        email: 'a@example.test',
        display_name: null,
        role: 'super-admin',
        created_at: '',
        updated_at: '',
      }),
    ).toThrowError(AuthError);
  });

  it('translates credentials, network and unknown errors', () => {
    expect(mapSupabaseError(new Error('Invalid login credentials')).code).toBe(
      'invalid-credentials',
    );
    expect(mapSupabaseError(new TypeError('Failed to fetch')).code).toBe(
      'network-unavailable',
    );
    expect(mapSupabaseError(new Error('strange')).code).toBe('unknown');
    expect(mapSupabaseError(new Error('JWT expired')).code).toBe(
      'session-expired',
    );
    expect(mapSupabaseError(new Error('permission denied')).code).toBe(
      'permission-denied',
    );
    const original = new AuthError('profile-missing', 'missing');
    expect(mapSupabaseError(original)).toBe(original);
  });

  it('maps optional session expiry and rejects a profile mismatch', () => {
    const profile = {
      id: 'a',
      email: 'a@example.test',
      role: 'user',
    } as const;
    expect(
      mapSession({ user: { id: 'a' } } as Session, profile),
    ).not.toHaveProperty('expiresAt');
    expect(() =>
      mapSession({ user: { id: 'b' } } as Session, profile),
    ).toThrowError(AuthError);
  });
});
