const CHATGPT_HOSTS = new Set(['chatgpt.com', 'www.chatgpt.com']);

export function parseChatGptImportUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && CHATGPT_HOSTS.has(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export const readChatGptImportUrl = () =>
  parseChatGptImportUrl(import.meta.env.VITE_CHATGPT_IMPORT_GPT_URL);
