import { describe, expect, it, vi } from 'vitest';
import {
  QUIZ_TSI_IMPORT_TOOL_NAME,
  QUIZ_TSI_MCP_PROTOCOL_VERSION,
  handleQuizTsiMcpRequest,
} from '../../../src/infrastructure/mcp/QuizTsiMcpProtocol';

const request = (id: number, method: string, params?: unknown) => ({
  jsonrpc: '2.0',
  id,
  method,
  ...(params === undefined ? {} : { params }),
});
const initializeParams = (protocolVersion = QUIZ_TSI_MCP_PROTOCOL_VERSION) => ({
  protocolVersion,
  capabilities: {},
  clientInfo: { name: 'test-client', version: '1.0.0' },
});
const initialized = { protocolVersion: QUIZ_TSI_MCP_PROTOCOL_VERSION };

describe('protocole MCP Quiz TSI', () => {
  it('valide initialize et annonce uniquement la capacité tools', async () => {
    const result = await handleQuizTsiMcpRequest(
      request(1, 'initialize', initializeParams()),
      'Bearer user-token',
      { importQuestionDrafts: vi.fn() },
    );
    expect(result.body).toMatchObject({
      result: {
        protocolVersion: QUIZ_TSI_MCP_PROTOCOL_VERSION,
        serverInfo: { name: 'quiz-tsi-mcp' },
        capabilities: { tools: { listChanged: false } },
      },
    });
  });

  it('négocie la seule version serveur quand le client propose une autre version', async () => {
    const result = await handleQuizTsiMcpRequest(
      request(2, 'initialize', initializeParams('2025-03-26')),
      'Bearer user-token',
      { importQuestionDrafts: vi.fn() },
    );
    expect(result.body).toMatchObject({
      result: { protocolVersion: QUIZ_TSI_MCP_PROTOCOL_VERSION },
    });
  });

  it.each([
    undefined,
    {},
    { capabilities: {}, clientInfo: { name: 'x', version: '1' } },
    {
      protocolVersion: QUIZ_TSI_MCP_PROTOCOL_VERSION,
      capabilities: [],
      clientInfo: { name: 'x', version: '1' },
    },
    {
      protocolVersion: QUIZ_TSI_MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: '', version: '1' },
    },
  ])('refuse les paramètres initialize mal formés %#', async (params) => {
    const result = await handleQuizTsiMcpRequest(
      request(3, 'initialize', params),
      'Bearer user-token',
      { importQuestionDrafts: vi.fn() },
    );
    expect(result.body).toMatchObject({ error: { code: -32602 } });
  });

  it('exige la version négociée sur les requêtes postérieures', async () => {
    const dependency = { importQuestionDrafts: vi.fn() };
    const missing = await handleQuizTsiMcpRequest(
      request(4, 'tools/list'),
      'Bearer user-token',
      dependency,
    );
    const unsupported = await handleQuizTsiMcpRequest(
      request(5, 'tools/list'),
      'Bearer user-token',
      dependency,
      { protocolVersion: '2025-03-26' },
    );
    expect(missing.status).toBe(400);
    expect(unsupported.status).toBe(400);
    expect(unsupported.body).toMatchObject({ error: { code: -32600 } });
  });

  it('liste l’unique outil après initialisation', async () => {
    const listed = await handleQuizTsiMcpRequest(
      request(6, 'tools/list'),
      'Bearer user-token',
      { importQuestionDrafts: vi.fn() },
      initialized,
    );
    expect(listed.body).toMatchObject({
      result: {
        tools: [
          {
            name: QUIZ_TSI_IMPORT_TOOL_NAME,
            annotations: { readOnlyHint: false, destructiveHint: false },
            inputSchema: {
              properties: {
                payload: {
                  additionalProperties: false,
                  properties: {
                    confirmedByUser: { const: true },
                    questions: { maxItems: 100 },
                  },
                },
              },
            },
          },
        ],
      },
    });
  });

  it('transmet sans modification le Bearer et le payload au backend existant', async () => {
    const payload = { schemaVersion: 1, importId: 'mcp-1' };
    const importQuestionDrafts = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { accepted: [0], replayed: false },
    });
    const result = await handleQuizTsiMcpRequest(
      request(7, 'tools/call', {
        name: QUIZ_TSI_IMPORT_TOOL_NAME,
        arguments: { payload },
      }),
      'Bearer exact-user-token',
      { importQuestionDrafts },
      initialized,
    );
    expect(importQuestionDrafts).toHaveBeenCalledWith(
      'Bearer exact-user-token',
      payload,
    );
    expect(result.body).toMatchObject({
      result: {
        isError: false,
        structuredContent: { accepted: [0], replayed: false },
      },
    });
  });

  it.each([
    { status: 422, kind: 'business', code: 'invalid-import' },
    { status: 503, kind: 'technical', code: 'import-backend-unavailable' },
  ])(
    'distingue une erreur $kind du backend',
    async ({ status, kind, code }) => {
      const result = await handleQuizTsiMcpRequest(
        request(8, 'tools/call', {
          name: QUIZ_TSI_IMPORT_TOOL_NAME,
          arguments: { payload: {} },
        }),
        'Bearer valid',
        {
          importQuestionDrafts: vi.fn().mockResolvedValue({
            ok: false,
            status,
            body: { code },
          }),
        },
        initialized,
      );
      expect(result.body).toMatchObject({
        result: {
          isError: true,
          structuredContent: { code },
          _meta: { backendStatus: status, errorKind: kind },
        },
      });
    },
  );

  it('conserve les erreurs JSON-RPC et accepte initialized', async () => {
    const dependency = { importQuestionDrafts: vi.fn() };
    expect(
      (
        await handleQuizTsiMcpRequest(
          request(9, 'unknown'),
          'Bearer x',
          dependency,
          initialized,
        )
      ).body,
    ).toMatchObject({ error: { code: -32601 } });
    expect(
      (
        await handleQuizTsiMcpRequest(
          request(10, 'tools/call', {
            name: 'publish_question',
            arguments: {},
          }),
          'Bearer x',
          dependency,
          initialized,
        )
      ).body,
    ).toMatchObject({ error: { code: -32602 } });
    expect(
      await handleQuizTsiMcpRequest(
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        'Bearer x',
        dependency,
        initialized,
      ),
    ).toEqual({ status: 202, body: null });
  });
});
