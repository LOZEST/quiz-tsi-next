import { createClient } from '@supabase/supabase-js';
import type { SupabaseEnvironment } from './environment';

export function createSupabaseBrowserClient({
  url,
  anonKey,
}: SupabaseEnvironment) {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
