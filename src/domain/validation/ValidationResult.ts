export type ValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type ValidationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; issues: readonly ValidationIssue[] }>;

export function valid<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

export function invalid<T>(
  ...issues: readonly ValidationIssue[]
): ValidationResult<T> {
  return { ok: false, issues };
}

export function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}
