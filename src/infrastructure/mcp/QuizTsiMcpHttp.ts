import { CHATGPT_IMPORT_LIMITS } from '../../domain/questions/import/ChatGptImportPolicy';
import { handleQuizTsiMcpRequest } from './QuizTsiMcpProtocol';

const MCP_ENVELOPE_CHARACTERS = 50_000;
const DEFAULT_ALLOWED_ORIGINS = [
  'https://chatgpt.com',
  'https://chat.openai.com',
] as const;

export interface McpTokenClaims {
  readonly subject: string;
  readonly issuer: string;
  readonly audience: string | readonly string[];
  readonly clientId: string;
}

interface QuizTsiMcpHttpConfig {
  readonly publicUrl: string;
  readonly authorizationServer: string;
  readonly expectedIssuer: string;
  readonly expectedAudience: string;
  readonly expectedClientId: string;
  readonly allowedOrigins?: readonly string[];
}

interface QuizTsiMcpHttpDependencies {
  readonly validateToken: (token: string) => Promise<McpTokenClaims | null>;
  readonly importQuestionDrafts: (
    authorization: string,
    payload: unknown,
  ) => Promise<{ ok: boolean; status: number; body: unknown }>;
}

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const canonicalUrl = (value: string) => value.replace(/\/$/, '');

const metadataUrl = (config: QuizTsiMcpHttpConfig) =>
  `${canonicalUrl(config.publicUrl)}?metadata=oauth-protected-resource`;

const challenge = (
  config: QuizTsiMcpHttpConfig,
  code: 'missing-token' | 'invalid-token',
) =>
  json({ code }, 401, {
    'www-authenticate': `Bearer realm="quiz-tsi-mcp", resource_metadata="${metadataUrl(config)}"${
      code === 'invalid-token' ? ', error="invalid_token"' : ''
    }`,
  });

const allowedAudience = (
  audience: string | readonly string[],
  expected: string,
) =>
  typeof audience === 'string'
    ? audience === expected
    : audience.includes(expected);

const originAllowed = (request: Request, config: QuizTsiMcpHttpConfig) => {
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  const configured = config.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  return configured.includes(origin);
};

export const createQuizTsiMcpHttpHandler =
  (config: QuizTsiMcpHttpConfig, dependencies: QuizTsiMcpHttpDependencies) =>
  async (request: Request): Promise<Response> => {
    if (!originAllowed(request, config))
      return json({ code: 'origin-forbidden' }, 403);

    const url = new URL(request.url);
    if (
      request.method === 'GET' &&
      url.searchParams.get('metadata') === 'oauth-protected-resource'
    )
      return json({
        resource: canonicalUrl(config.publicUrl),
        authorization_servers: [canonicalUrl(config.authorizationServer)],
        bearer_methods_supported: ['header'],
        scopes_supported: ['email'],
      });

    if (request.method === 'GET')
      return json({ code: 'sse-not-supported' }, 405, { allow: 'POST' });
    if (request.method !== 'POST')
      return json({ code: 'method-not-allowed' }, 405, { allow: 'POST' });

    const authorization = request.headers.get('authorization');
    const bearerMatch = authorization?.match(/^Bearer ([^\s]+)$/);
    if (!bearerMatch) return challenge(config, 'missing-token');

    const claims = await dependencies.validateToken(bearerMatch[1]!);
    if (
      !claims ||
      claims.issuer !== canonicalUrl(config.expectedIssuer) ||
      claims.clientId !== config.expectedClientId ||
      !allowedAudience(claims.audience, config.expectedAudience)
    )
      return challenge(config, 'invalid-token');

    let input: unknown;
    try {
      const raw = await request.text();
      if (
        raw.length >
        CHATGPT_IMPORT_LIMITS.totalCharacters + MCP_ENVELOPE_CHARACTERS
      )
        return json({ code: 'payload-too-large' }, 413);
      input = JSON.parse(raw) as unknown;
    } catch {
      return json(
        {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        },
        400,
      );
    }

    const result = await handleQuizTsiMcpRequest(
      input,
      authorization!,
      { importQuestionDrafts: dependencies.importQuestionDrafts },
      { protocolVersion: request.headers.get('mcp-protocol-version') },
    );
    return result.body === null
      ? new Response(null, { status: result.status })
      : json(result.body, result.status);
  };

export const parseAllowedOrigins = (value: string | undefined) =>
  value === undefined
    ? [...DEFAULT_ALLOWED_ORIGINS]
    : value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
