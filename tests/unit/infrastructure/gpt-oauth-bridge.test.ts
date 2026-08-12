import { describe, expect, it, vi } from 'vitest';
import {
  createAuthorizeHandler,
  createCallbackHandler,
  createTokenHandler,
  OPENAI_GPT_REDIRECT_URI,
  type BridgeConfig,
  type BridgeDependencies,
} from '../../../supabase/functions/_shared/gpt-oauth-bridge.ts';

const bytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const bridgeSecret = btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/u, '');
const config: BridgeConfig = {
  supabaseUrl: 'https://project.supabase.co',
  clientId: 'oauth-client',
  clientSecret: 'oauth-secret',
  redirectUri: OPENAI_GPT_REDIRECT_URI,
  callbackUrl: 'https://project.supabase.co/functions/v1/gpt-oauth-callback',
  bridgeSecret,
};
const basic = `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`;

const harness = (initialNow = 1_800_000_000_000) => {
  let now = initialNow;
  let randomCall = 0;
  const upstream = vi.fn<typeof fetch>();
  const dependencies: Partial<BridgeDependencies> = {
    now: () => now,
    randomBytes: (length) => {
      randomCall += 1;
      return Uint8Array.from(
        { length },
        (_, index) => (index + randomCall * 17) % 256,
      );
    },
    fetch: upstream,
  };
  return {
    authorize: createAuthorizeHandler(config, dependencies),
    callback: createCallbackHandler(config, dependencies),
    token: createTokenHandler(config, dependencies),
    upstream,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
};

const authorizeRequest = (overrides: Record<string, string> = {}) => {
  const url = new URL('https://bridge.example/authorize');
  const parameters = {
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'email',
    state: 'openai-state',
    ...overrides,
  };
  for (const [name, value] of Object.entries(parameters))
    url.searchParams.set(name, value);
  return new Request(url);
};

const readRedirect = (response: Response) => {
  expect(response.status).toBe(302);
  return new URL(response.headers.get('location')!);
};

const createBridgeCode = async (flow = harness()) => {
  const authorization = readRedirect(await flow.authorize(authorizeRequest()));
  const callback = new URL(config.callbackUrl);
  callback.searchParams.set('code', 'supabase-authorization-code');
  callback.searchParams.set('state', authorization.searchParams.get('state')!);
  const openAiRedirect = readRedirect(
    await flow.callback(new Request(callback)),
  );
  return { flow, authorization, openAiRedirect };
};

const tokenRequest = (form: Record<string, string>, authorization = basic) =>
  new Request('https://bridge.example/token', {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(form),
  });

describe('GPT OAuth PKCE bridge', () => {
  it('ajoute un challenge PKCE S256 et protège le state OpenAI', async () => {
    const flow = harness();
    const location = readRedirect(await flow.authorize(authorizeRequest()));

    expect(location.origin).toBe('https://project.supabase.co');
    expect(location.pathname).toBe('/auth/v1/oauth/authorize');
    expect(location.searchParams.get('redirect_uri')).toBe(config.callbackUrl);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/u);
    expect(location.searchParams.get('state')).not.toContain('openai-state');
  });

  it.each([
    ['response_type', 'token'],
    ['client_id', 'other'],
    ['redirect_uri', 'https://attacker.example/callback'],
    ['scope', 'openid'],
    ['state', ''],
  ])('rejette un paramètre authorize invalide : %s', async (name, value) => {
    const response = await harness().authorize(
      authorizeRequest({ [name]: value }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_request',
    });
  });

  it('restaure le state original sans échanger le code dans le callback', async () => {
    const { flow, openAiRedirect } = await createBridgeCode();
    expect(openAiRedirect.origin + openAiRedirect.pathname).toBe(
      config.redirectUri,
    );
    expect(openAiRedirect.searchParams.get('state')).toBe('openai-state');
    expect(openAiRedirect.searchParams.get('code')).not.toBe(
      'supabase-authorization-code',
    );
    expect(flow.upstream).not.toHaveBeenCalled();
  });

  it('retransmet une erreur Supabase à la callback OpenAI', async () => {
    const flow = harness();
    const authorization = readRedirect(
      await flow.authorize(authorizeRequest()),
    );
    const callback = new URL(config.callbackUrl);
    callback.searchParams.set('error', 'access_denied');
    callback.searchParams.set('error_description', 'Consent refused');
    callback.searchParams.set(
      'state',
      authorization.searchParams.get('state')!,
    );

    const location = readRedirect(await flow.callback(new Request(callback)));
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('error_description')).toBe(
      'Consent refused',
    );
    expect(location.searchParams.get('state')).toBe('openai-state');
  });

  it('échange le bridge code contre les jetons Supabase avec le verifier', async () => {
    const { flow, openAiRedirect } = await createBridgeCode();
    flow.upstream.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: 'access', refresh_token: 'refresh' }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const response = await flow.token(
      tokenRequest({
        grant_type: 'authorization_code',
        code: openAiRedirect.searchParams.get('code')!,
        redirect_uri: config.redirectUri,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      access_token: 'access',
      refresh_token: 'refresh',
    });
    const [url, init] = flow.upstream.mock.calls[0]!;
    expect(url).toEqual(
      new URL('https://project.supabase.co/auth/v1/oauth/token'),
    );
    expect((init?.headers as Record<string, string>).authorization).toBe(basic);
    const proxied = init?.body as URLSearchParams;
    expect(proxied.get('code')).toBe('supabase-authorization-code');
    expect(proxied.get('redirect_uri')).toBe(config.callbackUrl);
    expect(proxied.get('code_verifier')).toMatch(/^[\w-]{43}$/u);
  });

  it('proxy le refresh token et conserve la réponse JSON Supabase', async () => {
    const flow = harness();
    flow.upstream.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'renewed' }), {
        status: 200,
      }),
    );
    const response = await flow.token(
      tokenRequest({ grant_type: 'refresh_token', refresh_token: 'refresh' }),
    );
    expect(await response.json()).toEqual({ access_token: 'renewed' });
    const proxied = flow.upstream.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(proxied.toString()).toBe(
      'grant_type=refresh_token&refresh_token=refresh',
    );
  });

  it('rejette un client secret incorrect', async () => {
    const response = await harness().token(
      tokenRequest(
        { grant_type: 'refresh_token', refresh_token: 'refresh' },
        `Basic ${btoa(`${config.clientId}:wrong`)}`,
      ),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_client',
    });
  });

  it('rejette les états altérés, expirés et de mauvais purpose', async () => {
    const flow = harness();
    const authorization = readRedirect(
      await flow.authorize(authorizeRequest()),
    );
    const state = authorization.searchParams.get('state')!;
    const altered = `${state.slice(0, -1)}${state.endsWith('A') ? 'B' : 'A'}`;
    const alteredCallback = new URL(config.callbackUrl);
    alteredCallback.searchParams.set('code', 'code');
    alteredCallback.searchParams.set('state', altered);
    expect(await flow.callback(new Request(alteredCallback))).toMatchObject({
      status: 400,
    });

    flow.advance(10 * 60 * 1000 + 1);
    const expiredCallback = new URL(config.callbackUrl);
    expiredCallback.searchParams.set('code', 'code');
    expiredCallback.searchParams.set('state', state);
    expect(await flow.callback(new Request(expiredCallback))).toMatchObject({
      status: 400,
    });

    const wrongPurpose = await flow.token(
      tokenRequest({
        grant_type: 'authorization_code',
        code: state,
        redirect_uri: config.redirectUri,
      }),
    );
    expect(wrongPurpose.status).toBe(400);
    await expect(wrongPurpose.json()).resolves.toMatchObject({
      error: 'invalid_grant',
    });
  });

  it('rejette un bridge code expiré et une redirect_uri non exacte', async () => {
    const expired = await createBridgeCode();
    expired.flow.advance(5 * 60 * 1000 + 1);
    const expiredResponse = await expired.flow.token(
      tokenRequest({
        grant_type: 'authorization_code',
        code: expired.openAiRedirect.searchParams.get('code')!,
        redirect_uri: config.redirectUri,
      }),
    );
    expect(expiredResponse.status).toBe(400);
    await expect(expiredResponse.json()).resolves.toMatchObject({
      error: 'invalid_grant',
    });

    const valid = await createBridgeCode();
    const wrongRedirect = await valid.flow.token(
      tokenRequest({
        grant_type: 'authorization_code',
        code: valid.openAiRedirect.searchParams.get('code')!,
        redirect_uri: `${config.redirectUri}/wrong`,
      }),
    );
    expect(wrongRedirect.status).toBe(400);
    expect(valid.flow.upstream).not.toHaveBeenCalled();
  });
});
