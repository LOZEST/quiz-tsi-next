export function normalizeBasename(baseUrl: string): string {
  if (baseUrl === '/') return '/';
  return `/${baseUrl.replace(/^\/+|\/+$/g, '')}`;
}
