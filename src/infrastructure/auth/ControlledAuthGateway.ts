import { AuthError } from '@domain/auth/AuthError';
import type {
  AuthChangeHandler,
  AuthGateway,
  SignUpResult,
} from '@domain/auth/AuthGateway';
import type { AuthSession } from '@domain/auth/AuthSession';
import { isUserRole, type UserRole } from '@domain/auth/UserRole';

const STORAGE_KEY = 'qtsi-controlled-auth-session';

function createSession(
  email: string,
  validity: AuthSession['validity'] = 'valid',
): AuthSession {
  const roleValue = email.split('@')[0];
  const role: UserRole = isUserRole(roleValue) ? roleValue : 'user';
  return {
    user: {
      id: `controlled-${role}`,
      email,
      role,
      displayName: `Compte ${role}`,
    },
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    validity,
    workspaceGeneration: 0,
  };
}

/**
 * Deterministic browser-test boundary. It is selected only by an explicit
 * build-time flag in the Playwright preview and is never a demo account.
 */
export class ControlledAuthGateway implements AuthGateway {
  getCurrentSession(): Promise<AuthSession | null> {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return Promise.resolve(null);
    try {
      const parsed = JSON.parse(stored) as {
        email: string;
        validity: AuthSession['validity'];
      };
      return Promise.resolve(createSession(parsed.email, parsed.validity));
    } catch {
      return Promise.resolve(createSession(stored));
    }
  }

  signInWithPassword(email: string, password: string): Promise<AuthSession> {
    if (password === 'network-unavailable') {
      return Promise.reject(
        new AuthError('network-unavailable', 'Controlled network failure.'),
      );
    }
    if (password !== 'test-password') {
      return Promise.reject(
        new AuthError('invalid-credentials', 'Controlled credential failure.'),
      );
    }
    sessionStorage.setItem(STORAGE_KEY, email);
    return Promise.resolve(createSession(email));
  }

  signUp(email: string, password: string): Promise<SignUpResult> {
    if (password === 'network-unavailable') {
      return Promise.reject(
        new AuthError('network-unavailable', 'Controlled network failure.'),
      );
    }
    if (password.length < 6) {
      return Promise.reject(
        new AuthError('weak-password', 'Controlled weak password.'),
      );
    }
    sessionStorage.setItem(STORAGE_KEY, email);
    return Promise.resolve({ status: 'signed-in', session: createSession(email) });
  }

  signOut(): Promise<void> {
    sessionStorage.removeItem(STORAGE_KEY);
    return Promise.resolve();
  }

  subscribeToAuthChanges(handler: AuthChangeHandler): () => void {
    void handler;
    return () => undefined;
  }
}
