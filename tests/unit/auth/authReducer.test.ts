import { AuthError } from '@domain/auth/AuthError';
import type { AuthSession } from '@domain/auth/AuthSession';
import {
  authReducer,
  initialAuthState,
} from '@features/auth/state/authReducer';

const session: AuthSession = {
  user: { id: 'user-a', email: 'a@example.test', role: 'user' },
  validity: 'valid',
  workspaceGeneration: 0,
};

describe('authReducer', () => {
  it('starts in the booting state', () => {
    expect(initialAuthState).toEqual({
      status: 'booting',
      generation: 0,
      operationId: 0,
    });
  });

  it('restores an absent session', () => {
    expect(
      authReducer(initialAuthState, {
        type: 'RESTORE_EMPTY',
        generation: 0,
        operationId: 0,
      }),
    ).toEqual({ status: 'unauthenticated', generation: 0 });
  });

  it('moves through authentication and stamps the generation', () => {
    const authenticating = authReducer(initialAuthState, {
      type: 'AUTHENTICATE_START',
      generation: 1,
      operationId: 2,
    });
    expect(authenticating.status).toBe('authenticating');
    const authenticated = authReducer(authenticating, {
      type: 'AUTHENTICATE_SUCCESS',
      generation: 1,
      operationId: 2,
      session,
    });
    expect(authenticated).toMatchObject({
      status: 'authenticated',
      generation: 1,
      session: { workspaceGeneration: 1 },
    });
  });

  it.each([
    'invalid-credentials',
    'network-unavailable',
    'configuration-missing',
  ] as const)('keeps a discriminated %s failure', (code) => {
    const authenticating = authReducer(initialAuthState, {
      type: 'AUTHENTICATE_START',
      generation: 1,
      operationId: 1,
    });
    const error = new AuthError(code, code);
    expect(
      authReducer(authenticating, {
        type: 'AUTHENTICATE_FAILURE',
        generation: 1,
        operationId: 1,
        error,
      }),
    ).toEqual({ status: 'unauthenticated', generation: 1, error });
  });

  it('cleans local state even when remote sign-out fails', () => {
    const authenticated = authReducer(
      {
        status: 'authenticating',
        generation: 1,
        operationId: 1,
      },
      {
        type: 'AUTHENTICATE_SUCCESS',
        generation: 1,
        operationId: 1,
        session,
      },
    );
    if (authenticated.status !== 'authenticated') throw new Error('fixture');
    const signingOut = authReducer(authenticated, {
      type: 'SIGN_OUT_START',
      generation: 2,
      operationId: 3,
      session: authenticated.session,
    });
    const error = new AuthError('network-unavailable', 'offline');
    expect(
      authReducer(signingOut, {
        type: 'SIGN_OUT_COMPLETE',
        generation: 2,
        operationId: 3,
        error,
      }),
    ).toEqual({ status: 'unauthenticated', generation: 2, error });
  });

  it('ignores stale generations and late operations', () => {
    const current = {
      status: 'authenticating',
      generation: 4,
      operationId: 9,
    } as const;
    expect(
      authReducer(current, {
        type: 'AUTHENTICATE_SUCCESS',
        generation: 3,
        operationId: 8,
        session,
      }),
    ).toBe(current);
  });

  it('handles offline restoration, invalidation and clean sign-out branches', () => {
    const authenticating = authReducer(initialAuthState, {
      type: 'AUTHENTICATE_START',
      generation: 2,
      operationId: 2,
    });
    const offline = authReducer(authenticating, {
      type: 'AUTHENTICATE_SUCCESS',
      generation: 2,
      operationId: 2,
      session,
      offline: true,
    });
    expect(offline).toMatchObject({ status: 'authenticated', offline: true });
    expect(
      authReducer(offline, { type: 'SESSION_INVALIDATED', generation: 3 }),
    ).toEqual({ status: 'unauthenticated', generation: 3 });
    expect(
      authReducer(
        {
          status: 'signing-out',
          generation: 4,
          operationId: 5,
          session,
        },
        {
          type: 'SIGN_OUT_COMPLETE',
          generation: 4,
          operationId: 5,
        },
      ),
    ).toEqual({ status: 'unauthenticated', generation: 4 });
  });

  it('ignores stale starts and stale invalidations', () => {
    const current = {
      status: 'unauthenticated',
      generation: 8,
    } as const;
    expect(
      authReducer(current, {
        type: 'AUTHENTICATE_START',
        generation: 7,
        operationId: 2,
      }),
    ).toBe(current);
    expect(
      authReducer(current, {
        type: 'SESSION_INVALIDATED',
        generation: 7,
      }),
    ).toBe(current);
  });
});
