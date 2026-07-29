import { appRoutes } from '@app/routes';

export function safeRedirectTarget(value: unknown): string {
  if (typeof value !== 'string') return '/whiteboard';
  if (!value.startsWith('/') || value.startsWith('//')) return '/whiteboard';
  try {
    const url = new URL(value, 'https://quiz-tsi.invalid');
    if (url.origin !== 'https://quiz-tsi.invalid') return '/whiteboard';
    return appRoutes.includes(url.pathname as (typeof appRoutes)[number])
      ? `${url.pathname}${url.search}${url.hash}`
      : '/whiteboard';
  } catch {
    return '/whiteboard';
  }
}
