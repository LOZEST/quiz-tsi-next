export const QUIZ_TSI_MCP_PROTOCOL_VERSION = '2025-06-18';
export const QUIZ_TSI_IMPORT_TOOL_NAME = 'import_question_drafts';

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

interface McpDependencies {
  importQuestionDrafts: (
    authorization: string,
    payload: unknown,
  ) => Promise<{ ok: boolean; status: number; body: unknown }>;
}

const importTool = {
  name: QUIZ_TSI_IMPORT_TOOL_NAME,
  title: 'Importer des brouillons de questions Quiz TSI',
  description:
    'Crée uniquement des brouillons privés non validés dans le compte Quiz TSI de l’utilisateur authentifié. Ne publie jamais de question.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['payload'],
    properties: {
      payload: {
        type: 'object',
        description:
          'Lot structuré conforme au contrat ChatGptQuestionImportV1. L’utilisateur doit avoir explicitement confirmé l’import.',
        additionalProperties: true,
        required: [
          'schemaVersion',
          'importId',
          'analysisCoverage',
          'confirmedByUser',
          'document',
          'questions',
        ],
        properties: {
          schemaVersion: { const: 1 },
          importId: { type: 'string', minLength: 1, maxLength: 200 },
          analysisCoverage: {
            enum: ['text-and-visuals', 'text-only', 'incomplete'],
          },
          confirmedByUser: { const: true },
          document: { type: 'object' },
          questions: { type: 'array', minItems: 1, maxItems: 100 },
        },
      },
    },
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseRequest = (value: unknown): JsonRpcRequest | null => {
  if (
    !isRecord(value) ||
    value.jsonrpc !== '2.0' ||
    typeof value.method !== 'string'
  )
    return null;
  if (
    'id' in value &&
    value.id !== null &&
    typeof value.id !== 'string' &&
    typeof value.id !== 'number'
  )
    return null;
  return value as unknown as JsonRpcRequest;
};

const success = (id: JsonRpcId, result: unknown) => ({
  jsonrpc: '2.0' as const,
  id,
  result,
});

const failure = (id: JsonRpcId, code: number, message: string) => ({
  jsonrpc: '2.0' as const,
  id,
  error: { code, message },
});

const textContent = (body: unknown) => [
  { type: 'text' as const, text: JSON.stringify(body) },
];

export const handleQuizTsiMcpRequest = async (
  input: unknown,
  authorization: string,
  dependencies: McpDependencies,
): Promise<{ status: number; body: unknown }> => {
  const request = parseRequest(input);
  if (!request)
    return { status: 400, body: failure(null, -32600, 'Invalid Request') };
  if (request.id === undefined) return { status: 202, body: null };

  if (request.method === 'initialize') {
    return {
      status: 200,
      body: success(request.id, {
        protocolVersion: QUIZ_TSI_MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'quiz-tsi-mcp', version: '1.0.0' },
      }),
    };
  }

  if (request.method === 'ping')
    return { status: 200, body: success(request.id, {}) };

  if (request.method === 'tools/list') {
    return {
      status: 200,
      body: success(request.id, { tools: [importTool] }),
    };
  }

  if (request.method === 'tools/call') {
    const params = isRecord(request.params) ? request.params : null;
    if (params?.name !== QUIZ_TSI_IMPORT_TOOL_NAME)
      return {
        status: 200,
        body: failure(request.id, -32602, 'Unknown tool'),
      };
    const args = isRecord(params.arguments) ? params.arguments : null;
    if (!args || !('payload' in args))
      return {
        status: 200,
        body: failure(request.id, -32602, 'Missing payload'),
      };
    const imported = await dependencies.importQuestionDrafts(
      authorization,
      args.payload,
    );
    return {
      status: 200,
      body: success(request.id, {
        content: textContent(imported.body),
        structuredContent: isRecord(imported.body) ? imported.body : undefined,
        isError: !imported.ok,
        _meta: { backendStatus: imported.status },
      }),
    };
  }

  return {
    status: 200,
    body: failure(request.id, -32601, 'Method not found'),
  };
};
