import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { AuthError } from '@domain/auth/AuthError';
import type {
  AuthChangeErrorHandler,
  AuthChangeHandler,
  AuthGateway,
  SignUpResult,
} from '@domain/auth/AuthGateway';
import type { AuthSession } from '@domain/auth/AuthSession';
import { normalizeBasename } from '@app/routing/basename';
import {
  mapProfile,
  mapSession,
  mapSupabaseError,
  type ProfileRow,
} from './SupabaseAuthMapper';

function signUpRedirectUrl(): string {
  const basename = normalizeBasename(import.meta.env.BASE_URL);
  return `${window.location.origin}${basename === '/' ? '' : basename}/login`;
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly client: SupabaseClient) {}

  async getCurrentSession(signal?: AbortSignal): Promise<AuthSession | null> {
    try {
      signal?.throwIfAborted();
      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;
      if (!data.session) return null;
      return await this.loadSession(data.session, signal);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  async signInWithPassword(
    email: string,
    password: string,
    signal?: AbortSignal,
  ): Promise<AuthSession> {
    try {
      signal?.throwIfAborted();
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (!data.session) {
        throw new AuthError('session-expired', 'No session returned.');
      }
      return await this.loadSession(data.session, signal);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  async signUp(
    email: string,
    password: string,
    signal?: AbortSignal,
  ): Promise<SignUpResult> {
    try {
      signal?.throwIfAborted();
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: signUpRedirectUrl() },
      });
      if (error) throw error;
      if (
        data.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        throw new AuthError(
          'email-already-registered',
          'Email already registered.',
        );
      }
      if (!data.session) {
        return { status: 'confirmation-required' };
      }
      return {
        status: 'signed-in',
        session: await this.loadSession(data.session, signal),
      };
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw mapSupabaseError(error);
  }

  subscribeToAuthChanges(
    handler: AuthChangeHandler,
    onError?: AuthChangeErrorHandler,
  ): () => void {
    let eventGeneration = 0;
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      const activeEventGeneration = ++eventGeneration;
      if (event === 'SIGNED_OUT' || !session) {
        handler(null);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void this.loadSession(session)
          .then((loadedSession) => {
            if (eventGeneration === activeEventGeneration) {
              handler(loadedSession);
            }
          })
          .catch((error: unknown) => {
            if (eventGeneration === activeEventGeneration) {
              onError?.(error);
            }
          });
      }
    });
    return () => {
      eventGeneration += 1;
      data.subscription.unsubscribe();
    };
  }

  private async loadSession(
    session: Session,
    signal?: AbortSignal,
  ): Promise<AuthSession> {
    try {
      signal?.throwIfAborted();
      const response = await this.client
        .from('profiles')
        .select('user_id,email,display_name,role,created_at,updated_at')
        .eq('user_id', session.user.id)
        .single();
      signal?.throwIfAborted();
      if (response.error) {
        if (response.error.code === 'PGRST116') {
          throw new AuthError('profile-missing', 'Profile not found.');
        }
        throw response.error;
      }
      return mapSession(session, mapProfile(response.data as ProfileRow));
    } catch (error) {
      const mapped = mapSupabaseError(error);
      if (mapped.code !== 'network-unavailable') throw mapped;
      throw new AuthError(
        'network-unavailable',
        'Profile could not be revalidated.',
        { cause: error },
        {
          userId: session.user.id,
          email: session.user.email ?? '',
          ...(session.expires_at
            ? {
                expiresAt: new Date(session.expires_at * 1000).toISOString(),
              }
            : {}),
        },
      );
    }
  }
}
