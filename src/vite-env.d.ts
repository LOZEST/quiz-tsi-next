/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_CHATGPT_IMPORT_GPT_URL?: string;
  readonly VITE_AUTH_ADAPTER?: 'controlled';
}
