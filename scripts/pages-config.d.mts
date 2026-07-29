export function normalizeBasePath(value?: string): string;

export function loadPagesBasePath(options?: {
  env?: Record<string, string | undefined>;
  cwd?: string;
  envFile?: string;
}): string;
