import { handleQuizTsiMcpRequest } from '../../../src/infrastructure/mcp/QuizTsiMcpProtocol.ts';
import { CHATGPT_IMPORT_LIMITS } from '../../../src/domain/questions/import/ChatGptImportPolicy.ts';

const MCP_ENVELOPE_CHARACTERS = 50_000;

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const publicUrl = (request: Request) => {
  const configured = Deno.env.get('QUIZ_TSI_MCP_PUBLIC_URL');
  return (
    configured?.replace(/\/$/, '') ??
    new URL(request.url).origin + new URL(request.url).pathname
  );
};

const authorizationServer = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  return supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1` : null;
};

const protectedResourceMetadata = (request: Request) => {
  const server = authorizationServer();
  if (!server) return json({ code: 'server-misconfigured' }, 503);
  return json({
    resource: publicUrl(request),
    authorization_servers: [server],
    bearer_methods_supported: ['header'],
    scopes_supported: ['email'],
  });
};

const unauthorized = (request: Request) => {
  const metadataUrl = `${publicUrl(request)}?metadata=oauth-protected-resource`;
  return json({ code: 'missing-token' }, 401, {
    'www-authenticate': `Bearer resource_metadata="${metadataUrl}"`,
  });
};

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (
    request.method === 'GET' &&
    url.searchParams.get('metadata') === 'oauth-protected-resource'
  )
    return protectedResourceMetadata(request);
  if (request.method !== 'POST')
    return json({ code: 'method-not-allowed' }, 405, { allow: 'POST' });

  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer \S+$/.test(authorization))
    return unauthorized(request);

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const backendUrl =
    Deno.env.get('GPT_QUESTION_IMPORT_URL') ??
    (supabaseUrl
      ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/gpt-question-import`
      : null);
  if (!backendUrl) return json({ code: 'server-misconfigured' }, 503);

  const result = await handleQuizTsiMcpRequest(input, authorization, {
    importQuestionDrafts: async (bearer, payload) => {
      try {
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            authorization: bearer,
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const body: unknown = await response.json().catch(() => ({
          code: 'invalid-backend-response',
        }));
        return { ok: response.ok, status: response.status, body };
      } catch {
        return {
          ok: false,
          status: 503,
          body: { code: 'import-backend-unavailable' },
        };
      }
    },
  });
  return result.body === null
    ? new Response(null, { status: result.status })
    : json(result.body, result.status);
});
