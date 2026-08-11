/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('artefacts Import ChatGPT', () => {
  it('expose une seule action d’écriture privée et aucun secret', () => {
    const openapi = readFileSync(
      'docs/integrations/chatgpt-import/openapi.yaml',
      'utf8',
    );
    expect(openapi).toContain('operationId: importQuestionDrafts');
    expect(openapi.match(/operationId:/g)).toHaveLength(1);
    expect(openapi).toContain('quizTsiOAuth: [email]');
    expect(openapi).toContain('email: Identifier le compte Quiz TSI');
    expect(openapi).not.toContain('questions.import');
    expect(openapi).not.toMatch(
      /OPENAI_API_KEY|service_role|Bearer [A-Za-z0-9]/,
    );
  });
  it('interdit un backend OpenAI financé par Quiz TSI', () => {
    const files = [
      'package.json',
      'supabase/functions/gpt-question-import/index.ts',
    ]
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(files).not.toContain('api.openai.com');
    expect(files).not.toContain('OPENAI_API_KEY');
    const packageJson: unknown = JSON.parse(
      readFileSync('package.json', 'utf8'),
    );
    expect(packageJson).toBeTypeOf('object');
    expect(packageJson).not.toBeNull();
    expect(
      (packageJson as { dependencies?: Record<string, unknown> }).dependencies,
    ).not.toHaveProperty('openai');
  });

  it('aligne la fonction Edge sur le statut 422 sans brouillon accepté', () => {
    const edge = readFileSync(
      'supabase/functions/gpt-question-import/index.ts',
      'utf8',
    );
    expect(edge).toContain('importReportHttpStatus(report)');
    expect(edge).toContain("client.rpc('import_chatgpt_question_drafts'");
  });

  it('expose le MCP comme relais Bearer vers la fonction métier existante', () => {
    const mcp = readFileSync(
      'supabase/functions/quiz-tsi-mcp/index.ts',
      'utf8',
    );
    const protocol = readFileSync(
      'src/infrastructure/mcp/QuizTsiMcpProtocol.ts',
      'utf8',
    );
    const transport = readFileSync(
      'src/infrastructure/mcp/QuizTsiMcpHttp.ts',
      'utf8',
    );
    expect(transport).toContain("request.headers.get('authorization')");
    expect(mcp).toContain('/functions/v1/gpt-question-import');
    expect(mcp).toContain('authorization,');
    expect(mcp).toContain('authClient.auth.getClaims(token)');
    expect(transport).toContain('claims.clientId !== config.expectedClientId');
    expect(transport).toContain('config.expectedAudience');
    expect(protocol).toContain(
      "QUIZ_TSI_IMPORT_TOOL_NAME = 'import_question_drafts'",
    );
    expect(protocol).toContain('Ne publie jamais de question');
    expect(protocol).not.toContain('publish_question');
    expect(`${mcp}\n${transport}`).not.toMatch(
      /service_role|SUPABASE_SERVICE_ROLE_KEY/,
    );
  });
});
