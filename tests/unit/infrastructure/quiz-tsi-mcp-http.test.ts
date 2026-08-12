import { describe, expect, it, vi } from 'vitest';
import {
  createQuizTsiMcpHttpHandler,
  parseAllowedOrigins,
  type McpTokenClaims,
} from '../../../src/infrastructure/mcp/QuizTsiMcpHttp';
import { QUIZ_TSI_MCP_PROTOCOL_VERSION } from '../../../src/infrastructure/mcp/QuizTsiMcpProtocol';

const publicUrl = 'https://project.supabase.co/functions/v1/quiz-tsi-mcp';
const validClaims: McpTokenClaims = {
  subject: 'user-a',
  issuer: 'https://project.supabase.co/auth/v1',
  audience: publicUrl,
  clientId: 'chatgpt-client',
};
const config = {
  publicUrl,
  authorizationServer: 'https://project.supabase.co/auth/v1',
  expectedIssuer: 'https://project.supabase.co/auth/v1',
  expectedAudience: publicUrl,
  expectedClientId: 'chatgpt-client',
  allowedOrigins: ['https://chatgpt.com'],
};
const initializeBody = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: QUIZ_TSI_MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'chatgpt', version: '1' },
  },
});
const dependencies = (claims: McpTokenClaims | null = validClaims) => ({
  validateToken: vi.fn().mockResolvedValue(claims),
  importQuestionDrafts: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: { accepted: [0] },
  }),
});
const post = (headers: Record<string, string> = {}, body = initializeBody) =>
  new Request(publicUrl, {
    method: 'POST',
    headers: { authorization: 'Bearer valid-token', ...headers },
    body,
  });

describe('transport HTTP MCP Quiz TSI', () => {
  it('autorise une Origin configurée et les requêtes sans Origin', async () => {
    for (const headers of [{ origin: 'https://chatgpt.com' }, {}]) {
      const response = await createQuizTsiMcpHttpHandler(
        config,
        dependencies(),
      )(post(headers));
      expect(response.status).toBe(200);
    }
    expect(parseAllowedOrigins(undefined)).toContain('https://chatgpt.com');
    expect(parseAllowedOrigins('https://one.test, https://two.test')).toEqual([
      'https://one.test',
      'https://two.test',
    ]);
  });

  it('refuse une Origin présente mais non autorisée avant authentification', async () => {
    const deps = dependencies();
    const response = await createQuizTsiMcpHttpHandler(
      config,
      deps,
    )(post({ origin: 'https://attacker.test' }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'origin-forbidden',
    });
    expect(deps.validateToken).not.toHaveBeenCalled();
  });

  it('expose la metadata RFC 9728 et un challenge exploitable', async () => {
    const handler = createQuizTsiMcpHttpHandler(config, dependencies());
    const metadata = await handler(
      new Request(`${publicUrl}?metadata=oauth-protected-resource`),
    );
    expect(metadata.status).toBe(200);
    await expect(metadata.json()).resolves.toEqual({
      resource: publicUrl,
      authorization_servers: ['https://project.supabase.co/auth/v1'],
      bearer_methods_supported: ['header'],
      scopes_supported: ['email'],
    });
    const challenged = await handler(
      new Request(publicUrl, { method: 'POST', body: initializeBody }),
    );
    expect(challenged.status).toBe(401);
    expect(challenged.headers.get('www-authenticate')).toContain(
      `resource_metadata="${publicUrl}?metadata=oauth-protected-resource"`,
    );
  });

  it.each([
    ['', 'Bearer syntaxe invalide'],
    ['Basic abc', 'schéma invalide'],
    ['Bearer with space', 'Bearer contenant un espace'],
  ])('refuse le header Authorization %s (%s)', async (authorization) => {
    const request = new Request(publicUrl, {
      method: 'POST',
      headers: authorization ? { authorization } : {},
      body: initializeBody,
    });
    const response = await createQuizTsiMcpHttpHandler(
      config,
      dependencies(),
    )(request);
    expect(response.status).toBe(401);
  });

  it('refuse un token expiré ou invalide vérifié par Supabase', async () => {
    const response = await createQuizTsiMcpHttpHandler(
      config,
      dependencies(null),
    )(post());
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain(
      'error="invalid_token"',
    );
  });

  it.each([
    [{ ...validClaims, audience: 'https://other-resource.test' }, 'audience'],
    [{ ...validClaims, clientId: 'other-client' }, 'client_id'],
    [
      { ...validClaims, issuer: 'https://other-project.test/auth/v1' },
      'issuer',
    ],
  ])('refuse un token valide avec un mauvais %s', async (claims) => {
    const deps = dependencies(claims);
    const response = await createQuizTsiMcpHttpHandler(config, deps)(post());
    expect(response.status).toBe(401);
    expect(deps.importQuestionDrafts).not.toHaveBeenCalled();
  });

  it('accepte le token lié à la ressource et contrôle MCP-Protocol-Version', async () => {
    const handler = createQuizTsiMcpHttpHandler(config, dependencies());
    expect((await handler(post())).status).toBe(200);
    const listed = await handler(
      post(
        { 'mcp-protocol-version': QUIZ_TSI_MCP_PROTOCOL_VERSION },
        JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      ),
    );
    expect(listed.status).toBe(200);
    const unsupported = await handler(
      post(
        { 'mcp-protocol-version': '2025-03-26' },
        JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }),
      ),
    );
    expect(unsupported.status).toBe(400);
  });

  it('ne transforme pas indisponibilité backend en faux succès métier', async () => {
    const deps = dependencies();
    deps.importQuestionDrafts.mockResolvedValue({
      ok: false,
      status: 503,
      body: { code: 'import-backend-unavailable' },
    });
    const response = await createQuizTsiMcpHttpHandler(
      config,
      deps,
    )(
      post(
        { 'mcp-protocol-version': QUIZ_TSI_MCP_PROTOCOL_VERSION },
        JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'import_question_drafts',
            arguments: { payload: {} },
          },
        }),
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        isError: true,
        _meta: { backendStatus: 503, errorKind: 'technical' },
      },
    });
  });

  it('retourne parse error et payload-too-large sans mutation', async () => {
    const deps = dependencies();
    const handler = createQuizTsiMcpHttpHandler(config, deps);
    const malformed = await handler(post({}, '{'));
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({
      error: { code: -32700 },
    });
    const oversized = await handler(post({}, 'x'.repeat(1_050_001)));
    expect(oversized.status).toBe(413);
    expect(deps.importQuestionDrafts).not.toHaveBeenCalled();
  });
});
