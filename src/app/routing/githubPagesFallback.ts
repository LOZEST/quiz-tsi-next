export const PAGES_REDIRECT_PARAMETER = '__qtsi_route';

function normalizeBase(baseUrl: string): string {
  const normalized = `/${baseUrl.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '/' : `${normalized}/`;
}

export function encodeGithubPagesRoute(
  location: Pick<Location, 'pathname' | 'search' | 'hash' | 'origin'>,
  baseUrl: string,
): string | null {
  const base = normalizeBase(baseUrl);
  if (!location.pathname.startsWith(base)) return null;

  const relativePath = location.pathname.slice(base.length);
  const route = `/${relativePath}${location.search}${location.hash}`;
  const target = new URL(base, location.origin);
  target.searchParams.set(PAGES_REDIRECT_PARAMETER, route);
  return target.href;
}

export function decodeGithubPagesRoute(
  location: Pick<Location, 'search' | 'origin'>,
  baseUrl: string,
): string | null {
  const params = new URLSearchParams(location.search);
  const encodedRoute = params.get(PAGES_REDIRECT_PARAMETER);
  if (!encodedRoute?.startsWith('/') || encodedRoute.startsWith('//')) {
    return null;
  }

  const candidate = new URL(encodedRoute, location.origin);
  if (candidate.origin !== location.origin) return null;

  const base = normalizeBase(baseUrl);
  return `${base === '/' ? '' : base.slice(0, -1)}${candidate.pathname}${candidate.search}${candidate.hash}`;
}

export function restoreGithubPagesLocation(
  browserWindow: Pick<Window, 'location' | 'history'>,
): boolean {
  const restored = decodeGithubPagesRoute(
    browserWindow.location,
    import.meta.env.BASE_URL,
  );
  if (!restored) return false;

  browserWindow.history.replaceState(null, '', restored);
  return true;
}
