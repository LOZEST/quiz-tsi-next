/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('artefacts Import ChatGPT', () => {
  it('publie les 82 notions du programme officiel V2 dans le Knowledge GPT', () => {
    const knowledge: unknown = JSON.parse(
      readFileSync(
        'docs/integrations/chatgpt-import/generated/program-knowledge.json',
        'utf8',
      ),
    );
    expect(knowledge).toMatchObject({
      schemaVersion: 1,
      generatedFrom: 'src/data/program/official-program-v2.json',
    });
    expect((knowledge as { notions: readonly unknown[] }).notions).toHaveLength(
      82,
    );
  });
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
});
