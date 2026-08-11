import { describe, expect, it, vi } from 'vitest';
import {
  QUIZ_TSI_IMPORT_TOOL_NAME,
  handleQuizTsiMcpRequest,
} from '../../../src/infrastructure/mcp/QuizTsiMcpProtocol';

const request = (id: number, method: string, params?: unknown) => ({
  jsonrpc: '2.0',
  id,
  method,
  ...(params === undefined ? {} : { params }),
});

describe('serveur MCP Quiz TSI', () => {
  it('annonce un serveur MCP stateless avec un unique outil d’import privé', async () => {
    const importQuestionDrafts = vi.fn();
    const initialized = await handleQuizTsiMcpRequest(
      request(1, 'initialize'),
      'Bearer user-token',
      { importQuestionDrafts },
    );
    expect(initialized.body).toMatchObject({
      result: {
        serverInfo: { name: 'quiz-tsi-mcp' },
        capabilities: { tools: {} },
      },
    });
    const listed = await handleQuizTsiMcpRequest(
      request(2, 'tools/list'),
      'Bearer user-token',
      { importQuestionDrafts },
    );
    expect(listed.body).toMatchObject({
      result: {
        tools: [
          {
            name: QUIZ_TSI_IMPORT_TOOL_NAME,
            annotations: { readOnlyHint: false, destructiveHint: false },
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
      request(3, 'tools/call', {
        name: QUIZ_TSI_IMPORT_TOOL_NAME,
        arguments: { payload },
      }),
      'Bearer exact-user-token',
      { importQuestionDrafts },
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

  it('expose les refus du backend comme erreur d’outil sans les masquer', async () => {
    const result = await handleQuizTsiMcpRequest(
      request(4, 'tools/call', {
        name: QUIZ_TSI_IMPORT_TOOL_NAME,
        arguments: { payload: {} },
      }),
      'Bearer invalid',
      {
        importQuestionDrafts: vi.fn().mockResolvedValue({
          ok: false,
          status: 422,
          body: { code: 'invalid-import' },
        }),
      },
    );
    expect(result.body).toMatchObject({
      result: {
        isError: true,
        structuredContent: { code: 'invalid-import' },
        _meta: { backendStatus: 422 },
      },
    });
  });

  it('refuse les méthodes et outils inconnus et accepte les notifications', async () => {
    const dependency = { importQuestionDrafts: vi.fn() };
    expect(
      (
        await handleQuizTsiMcpRequest(
          request(5, 'unknown'),
          'Bearer x',
          dependency,
        )
      ).body,
    ).toMatchObject({ error: { code: -32601 } });
    expect(
      (
        await handleQuizTsiMcpRequest(
          request(6, 'tools/call', { name: 'publish_question', arguments: {} }),
          'Bearer x',
          dependency,
        )
      ).body,
    ).toMatchObject({ error: { code: -32602 } });
    expect(
      await handleQuizTsiMcpRequest(
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        'Bearer x',
        dependency,
      ),
    ).toEqual({ status: 202, body: null });
  });
});
