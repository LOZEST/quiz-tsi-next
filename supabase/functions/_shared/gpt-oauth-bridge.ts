export const OPENAI_GPT_REDIRECT_URI =
  'https://chat.openai.com/aip/g-6911186baceee17745bfc3e22a1736d6a7c5b084/oauth/callback';

const STATE_TTL_MS = 10 * 60 * 1000;
const CODE_TTL_MS = 5 * 60 * 1000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type Purpose = 'oauth-state' | 'bridge-code';

interface Envelope {
  version: 1;
  purpose: Purpose;
  expiresAt: number;
}

interface OAuthState extends Envelope {
  purpose: 'oauth-state';
  originalState: string;
  originalRedirectUri: string;
  scope: 'email';
  verifier: string;
}

interface BridgeCode extends Envelope {
  purpose: 'bridge-code';
  supabaseCode: string;
  verifier: string;
  originalRedirectUri: string;
}

export interface BridgeConfig {
  supabaseUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  callbackUrl: string;
  bridgeSecret: string;
}

export interface BridgeDependencies {
  fetch: typeof fetch;
  now: () => number;
  randomBytes: (length: number) => Uint8Array;
}

const defaultDependencies: BridgeDependencies = {
  fetch,
  now: Date.now,
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
};

const base64UrlEncode = (value: Uint8Array) => {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
};

const base64UrlDecode = (value: string) => {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error('invalid-base64url');
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const importBridgeKey = async (secret: string) => {
  const raw = base64UrlDecode(secret);
  if (raw.byteLength !== 32) throw new Error('invalid-bridge-secret');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
};

const seal = async <T extends Envelope>(
  payload: T,
  secret: string,
  randomBytes: BridgeDependencies['randomBytes'],
) => {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    await importBridgeKey(secret),
    encoder.encode(JSON.stringify(payload)),
  );
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(encrypted))}`;
};

const open = async <T extends Envelope>(
  value: string,
  secret: string,
  purpose: Purpose,
  now: number,
): Promise<T | null> => {
  try {
    const [prefix, encodedIv, encodedCiphertext, extra] = value.split('.');
    if (prefix !== 'v1' || !encodedIv || !encodedCiphertext || extra)
      return null;
    const iv = base64UrlDecode(encodedIv);
    if (iv.byteLength !== 12) return null;
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      await importBridgeKey(secret),
      base64UrlDecode(encodedCiphertext),
    );
    const payload: unknown = JSON.parse(decoder.decode(decrypted));
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('version' in payload) ||
      payload.version !== 1 ||
      !('purpose' in payload) ||
      payload.purpose !== purpose ||
      !('expiresAt' in payload) ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= now
    )
      return null;
    return payload as T;
  } catch {
    return null;
  }
};

const safeEqual = (left: string, right: string) => {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1)
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  return difference === 0;
};

const oauthError = (error: string, status: number, description?: string) =>
  new Response(
    JSON.stringify({
      error,
      ...(description ? { error_description: description } : {}),
    }),
    {
      status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        pragma: 'no-cache',
      },
    },
  );

const secureRedirect = (url: URL) =>
  new Response(null, {
    status: 302,
    headers: {
      location: url.href,
      'cache-control': 'no-store',
      pragma: 'no-cache',
      'referrer-policy': 'no-referrer',
    },
  });

const redirect = (uri: string, parameters: Record<string, string>) => {
  const url = new URL(uri);
  for (const [name, value] of Object.entries(parameters))
    url.searchParams.set(name, value);
  return secureRedirect(url);
};

const validConfig = (config: BridgeConfig) =>
  Boolean(
    config.supabaseUrl &&
    config.clientId &&
    config.clientSecret &&
    config.callbackUrl &&
    config.bridgeSecret &&
    config.redirectUri === OPENAI_GPT_REDIRECT_URI,
  );

const parseBasicCredentials = (authorization: string | null) => {
  if (!authorization?.startsWith('Basic ')) return null;
  try {
    const bytes = Uint8Array.from(atob(authorization.slice(6)), (character) =>
      character.charCodeAt(0),
    );
    const credentials = decoder.decode(bytes);
    const separator = credentials.indexOf(':');
    return separator < 0
      ? null
      : {
          clientId: credentials.slice(0, separator),
          clientSecret: credentials.slice(separator + 1),
        };
  } catch {
    return null;
  }
};

const pkcePair = async (randomBytes: BridgeDependencies['randomBytes']) => {
  const verifier = base64UrlEncode(randomBytes(32));
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(verifier),
  );
  return { verifier, challenge: base64UrlEncode(new Uint8Array(digest)) };
};

export const createAuthorizeHandler = (
  config: BridgeConfig,
  dependencies: Partial<BridgeDependencies> = {},
) => {
  const deps = { ...defaultDependencies, ...dependencies };
  return async (request: Request) => {
    if (!validConfig(config)) return oauthError('server_error', 503);
    if (request.method !== 'GET') return oauthError('invalid_request', 405);
    const url = new URL(request.url);
    const responseType = url.searchParams.get('response_type');
    const clientId = url.searchParams.get('client_id');
    const redirectUri = url.searchParams.get('redirect_uri');
    const scope = url.searchParams.get('scope');
    const originalState = url.searchParams.get('state');
    if (
      responseType !== 'code' ||
      clientId !== config.clientId ||
      redirectUri !== config.redirectUri ||
      scope !== 'email' ||
      !originalState
    )
      return oauthError('invalid_request', 400);

    const { verifier, challenge } = await pkcePair(deps.randomBytes);
    const state = await seal(
      {
        version: 1,
        purpose: 'oauth-state',
        expiresAt: deps.now() + STATE_TTL_MS,
        originalState,
        originalRedirectUri: redirectUri,
        scope,
        verifier,
      } satisfies OAuthState,
      config.bridgeSecret,
      deps.randomBytes,
    );
    const authorizationUrl = new URL(
      '/auth/v1/oauth/authorize',
      config.supabaseUrl,
    );
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', config.callbackUrl);
    authorizationUrl.searchParams.set('scope', scope);
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('code_challenge', challenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    return secureRedirect(authorizationUrl);
  };
};

export const createCallbackHandler = (
  config: BridgeConfig,
  dependencies: Partial<BridgeDependencies> = {},
) => {
  const deps = { ...defaultDependencies, ...dependencies };
  return async (request: Request) => {
    if (!validConfig(config)) return oauthError('server_error', 503);
    if (request.method !== 'GET') return oauthError('invalid_request', 405);
    const url = new URL(request.url);
    const stateValue = url.searchParams.get('state');
    if (!stateValue) return oauthError('invalid_request', 400);
    const state = await open<OAuthState>(
      stateValue,
      config.bridgeSecret,
      'oauth-state',
      deps.now(),
    );
    if (
      !state ||
      state.originalRedirectUri !== config.redirectUri ||
      state.scope !== 'email' ||
      !state.originalState ||
      !state.verifier
    )
      return oauthError('invalid_request', 400);

    const upstreamError = url.searchParams.get('error');
    if (upstreamError)
      return redirect(state.originalRedirectUri, {
        error: upstreamError.slice(0, 100),
        ...(url.searchParams.get('error_description')
          ? {
              error_description: url.searchParams
                .get('error_description')!
                .slice(0, 500),
            }
          : {}),
        state: state.originalState,
      });

    const supabaseCode = url.searchParams.get('code');
    if (!supabaseCode) return oauthError('invalid_request', 400);
    const bridgeCode = await seal(
      {
        version: 1,
        purpose: 'bridge-code',
        expiresAt: deps.now() + CODE_TTL_MS,
        supabaseCode,
        verifier: state.verifier,
        originalRedirectUri: state.originalRedirectUri,
      } satisfies BridgeCode,
      config.bridgeSecret,
      deps.randomBytes,
    );
    return redirect(state.originalRedirectUri, {
      code: bridgeCode,
      state: state.originalState,
    });
  };
};

export const createTokenHandler = (
  config: BridgeConfig,
  dependencies: Partial<BridgeDependencies> = {},
) => {
  const deps = { ...defaultDependencies, ...dependencies };
  return async (request: Request) => {
    if (!validConfig(config)) return oauthError('server_error', 503);
    if (request.method !== 'POST') return oauthError('invalid_request', 405);
    const credentials = parseBasicCredentials(
      request.headers.get('authorization'),
    );
    if (
      !credentials ||
      !safeEqual(credentials.clientId, config.clientId) ||
      !safeEqual(credentials.clientSecret, config.clientSecret)
    )
      return oauthError('invalid_client', 401);
    if (
      !request.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('application/x-www-form-urlencoded')
    )
      return oauthError('invalid_request', 400);

    const form = new URLSearchParams(await request.text());
    const grantType = form.get('grant_type');
    const upstreamForm = new URLSearchParams({ grant_type: grantType ?? '' });
    if (grantType === 'authorization_code') {
      const codeValue = form.get('code');
      const redirectUri = form.get('redirect_uri');
      if (!codeValue || redirectUri !== config.redirectUri)
        return oauthError('invalid_request', 400);
      const code = await open<BridgeCode>(
        codeValue,
        config.bridgeSecret,
        'bridge-code',
        deps.now(),
      );
      if (
        !code ||
        code.originalRedirectUri !== config.redirectUri ||
        !code.supabaseCode ||
        !code.verifier
      )
        return oauthError('invalid_grant', 400);
      upstreamForm.set('code', code.supabaseCode);
      upstreamForm.set('redirect_uri', config.callbackUrl);
      upstreamForm.set('code_verifier', code.verifier);
    } else if (grantType === 'refresh_token') {
      const refreshToken = form.get('refresh_token');
      if (!refreshToken) return oauthError('invalid_request', 400);
      upstreamForm.set('refresh_token', refreshToken);
    } else {
      return oauthError('unsupported_grant_type', 400);
    }

    const upstream = await deps.fetch(
      new URL('/auth/v1/oauth/token', config.supabaseUrl),
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: upstreamForm,
      },
    );
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        pragma: 'no-cache',
      },
    });
  };
};
