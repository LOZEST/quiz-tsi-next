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
});
