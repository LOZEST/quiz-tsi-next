import type { BridgeConfig } from './gpt-oauth-bridge.ts';

export const readBridgeConfig = (): BridgeConfig => ({
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  clientId: Deno.env.get('QUIZ_TSI_GPT_OAUTH_CLIENT_ID') ?? '',
  clientSecret: Deno.env.get('QUIZ_TSI_GPT_OAUTH_CLIENT_SECRET') ?? '',
  redirectUri: Deno.env.get('QUIZ_TSI_GPT_REDIRECT_URI') ?? '',
  callbackUrl: Deno.env.get('QUIZ_TSI_OAUTH_BRIDGE_CALLBACK_URL') ?? '',
  bridgeSecret: Deno.env.get('QUIZ_TSI_OAUTH_BRIDGE_SECRET') ?? '',
});
