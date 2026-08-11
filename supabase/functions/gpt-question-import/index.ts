import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import {
  canonicalizeImport,
  validateChatGptQuestionImport,
} from '../../../src/domain/questions/import/ChatGptQuestionImport.ts';
import { CHATGPT_IMPORT_LIMITS } from '../../../src/domain/questions/import/ChatGptImportPolicy.ts';
import { importReportHttpStatus } from '../../../src/domain/questions/import/ChatGptImportHttp.ts';
import type { ImportReportV1 } from '../../../src/domain/questions/import/ChatGptQuestionImport.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const sha256 = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
const jwtPayload = (token: string): Record<string, unknown> => {
  try {
    const encoded = token.split('.')[1] ?? '';
    const value: unknown = JSON.parse(
      atob(encoded.replace(/-/g, '+').replace(/_/g, '/')),
    );
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  if (request.method !== 'POST')
    return json({ requestId, code: 'method-not-allowed' }, 405);
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer '))
    return json({ requestId, code: 'missing-token' }, 401);
  const token = authorization.slice(7);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const expectedClientId = Deno.env.get('QUIZ_TSI_GPT_OAUTH_CLIENT_ID');
  if (!supabaseUrl || !anonKey || !expectedClientId)
    return json({ requestId, code: 'server-misconfigured' }, 503);
  const claims = jwtPayload(token);
  const oauthClientId =
    typeof claims.client_id === 'string' ? claims.client_id : null;
  if (oauthClientId !== expectedClientId)
    return json({ requestId, code: 'oauth-client-forbidden' }, 403);
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user)
    return json({ requestId, code: 'invalid-token' }, 401);
  const raw = await request.text();
  if (raw.length > CHATGPT_IMPORT_LIMITS.totalCharacters)
    return json({ requestId, code: 'payload-too-large' }, 413);
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ requestId, code: 'invalid-json' }, 400);
  }
  const validated = validateChatGptQuestionImport(input);
  if (!validated.ok)
    return json(
      { requestId, code: 'invalid-import', issues: validated.issues },
      422,
    );
  const warnings = [];
  if (validated.value.analysisCoverage !== 'text-and-visuals')
    warnings.push({
      index: -1,
      code: validated.value.analysisCoverage,
      path: 'analysisCoverage',
      message:
        validated.value.analysisCoverage === 'incomplete'
          ? 'L’analyse du document est incomplète.'
          : 'Les visuels du document n’ont pas été analysés.',
    });
  const payloadHash = await sha256(canonicalizeImport(input));
  const { data, error } = await client.rpc('import_chatgpt_question_drafts', {
    p_oauth_client_id: oauthClientId,
    p_payload_hash: payloadHash,
    p_payload: validated.value,
    p_accepted_indices: validated.acceptedIndices,
    p_quarantined: validated.quarantined,
    p_warnings: warnings,
  });
  if (error) return json({ requestId, code: 'atomic-import-failed' }, 422);
  if (data?.kind === 'conflict')
    return json({ requestId, code: 'import-id-conflict' }, 409);
  const report = data?.report as ImportReportV1 | undefined;
  return report
    ? json(report, importReportHttpStatus(report))
    : json({ requestId, code: 'invalid-rpc-result' }, 200);
});
