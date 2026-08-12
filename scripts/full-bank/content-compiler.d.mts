import type { ContentSegment } from '../../src/domain/questions/Question.ts';

export function compileContent(
  source: string,
  parameterIds: readonly string[],
): Readonly<{
  segments: ContentSegment[];
  structured: number;
  fallback: number;
}>;
