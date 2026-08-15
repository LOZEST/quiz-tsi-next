import type { Session } from '@supabase/supabase-js';
import { AuthError } from '@domain/auth/AuthError';
import type { AuthSession } from '@domain/auth/AuthSession';
import type { AuthUser } from '@domain/auth/AuthUser';
import { isUserRole } from '@domain/auth/UserRole';

export interface ProfileRow {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export function mapProfile(row: ProfileRow | null): AuthUser {
  if (!row) throw new AuthError('profile-missing', 'Profile row is missing.');
  if (!isUserRole(row.role)) {
    throw new AuthError('permission-denied', 'Profile role is invalid.');
  }
  return {
    id: row.user_id,
    email: row.email,
    role: row.role,
    ...(row.display_name ? { displayName: row.display_name } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSession(
  session: Session,
  profile: AuthUser,
  generation = 0,
): AuthSession {
  if (session.user.id !== profile.id) {
    throw new AuthError('permission-denied', 'Session and profile differ.');
  }
  return {
    user: profile,
    ...(session.expires_at
      ? { expiresAt: new Date(session.expires_at * 1000).toISOString() }
      : {}),
    validity: 'valid',
    workspaceGeneration: generation,
  };
}

export function mapSupabaseError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
        ? error.message.toLowerCase()
        : String(error).toLowerCase();
  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials')
  ) {
    return new AuthError('invalid-credentials', 'Credentials rejected.');
  }
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('offline')
  ) {
    return new AuthError('network-unavailable', 'Network unavailable.');
  }
  if (message.includes('jwt') || message.includes('expired')) {
    return new AuthError('session-expired', 'Session expired.');
  }
  if (
    message.includes('permission') ||
    message.includes('row-level security')
  ) {
    return new AuthError('permission-denied', 'Permission denied.');
  }
  if (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('user already')
  ) {
    return new AuthError(
      'email-already-registered',
      'Email already registered.',
    );
  }
  if (message.includes('password')) {
    return new AuthError('weak-password', 'Password rejected.');
  }
  return new AuthError('unknown', 'Unexpected authentication error.', {
    cause: error,
  });
}
