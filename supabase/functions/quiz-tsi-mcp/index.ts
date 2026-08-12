import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import {
  createQuizTsiMcpHttpHandler,
  parseAllowedOrigins,
} from '../../../src/infrastructure/mcp/QuizTsiMcpHttp.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const publicUrl = Deno.env.get('QUIZ_TSI_MCP_PUBLIC_URL')?.replace(/\/$/, '');
const expectedAudience = Deno.env.get('QUIZ_TSI_MCP_TOKEN_AUDIENCE');
const expectedClientId = Deno.env.get('QUIZ_TSI_GPT_OAUTH_CLIENT_ID');
const backendUrl =
  Deno.env.get('GPT_QUESTION_IMPORT_URL') ??
  (supabaseUrl ? `${supabaseUrl}/functions/v1/gpt-question-import` : null);

if (
  !supabaseUrl ||
  !anonKey ||
  !publicUrl ||
  !expectedAudience ||
  !expectedClientId ||
  !backendUrl
)
  throw new Error('quiz-tsi-mcp server configuration is incomplete');

const authClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false },
});

const handler = createQuizTsiMcpHttpHandler(
  {
    publicUrl,
    authorizationServer: `${supabaseUrl}/auth/v1`,
    expectedIssuer: `${supabaseUrl}/auth/v1`,
    expectedAudience,
    expectedClientId,
    allowedOrigins: parseAllowedOrigins(
      Deno.env.get('QUIZ_TSI_MCP_ALLOWED_ORIGINS'),
    ),
  },
  {
    validateToken: async (token) => {
      const { data, error } = await authClient.auth.getClaims(token);
      if (error || !data?.claims) return null;
      const claims = data.claims;
      if (
        typeof claims.sub !== 'string' ||
        typeof claims.iss !== 'string' ||
        (typeof claims.aud !== 'string' &&
          (!Array.isArray(claims.aud) ||
            !claims.aud.every((audience) => typeof audience === 'string'))) ||
        typeof claims.client_id !== 'string'
      )
        return null;
      return {
        subject: claims.sub,
        issuer: claims.iss,
        audience: claims.aud,
        clientId: claims.client_id,
      };
    },
    importQuestionDrafts: async (authorization, payload) => {
      try {
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            authorization,
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
  },
);

Deno.serve(handler);
