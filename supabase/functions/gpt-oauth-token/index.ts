import { createTokenHandler } from '../_shared/gpt-oauth-bridge.ts';
import { readBridgeConfig } from '../_shared/gpt-oauth-env.ts';

Deno.serve(createTokenHandler(readBridgeConfig()));
