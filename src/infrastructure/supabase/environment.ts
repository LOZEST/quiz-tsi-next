import { AuthError } from '@domain/auth/AuthError';

export interface SupabaseEnvironment {
  url: string;
  anonKey: string;
}

export function readSupabaseEnvironment(
  env: Record<string, string | boolean | undefined>,
): SupabaseEnvironment {
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (typeof url !== 'string' || typeof anonKey !== 'string') {
    throw new AuthError(
      'configuration-missing',
      'Supabase public environment is missing.',
    );
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || anonKey.length < 20) {
      throw new Error('Invalid public Supabase environment.');
    }
  } catch (error) {
    throw new AuthError(
      'configuration-missing',
      'Supabase public environment is invalid.',
      { cause: error },
    );
  }
  return { url, anonKey };
}
