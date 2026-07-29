import { describe, expect, it } from 'vitest';

import {
  loadPagesBasePath,
  normalizeBasePath,
} from '../../scripts/pages-config.mjs';
import { createPagesFallback } from '../../scripts/pages-fallback-template.mjs';

describe('Pages base path configuration', () => {
  it.each(['/', '/quiz-tsi-next/'])(
    'accepts the same-origin path %s',
    (basePath) => {
      expect(normalizeBasePath(basePath)).toBe(basePath);
    },
  );

  it.each([
    'quiz-tsi-next/',
    '/quiz-tsi-next',
    '/quiz-tsi-next/../admin/',
    '/quiz-tsi-next/%2e%2e/admin/',
    'https://example.com/quiz-tsi-next/',
    '//example.com/quiz-tsi-next/',
    '/quiz-tsi-next/?next=/admin',
    '/quiz-tsi-next/#section',
  ])('rejects unsafe or malformed path %s', (basePath) => {
    expect(() => normalizeBasePath(basePath)).toThrow();
  });

  it('uses an explicit environment value before the Pages env file', () => {
    expect(
      loadPagesBasePath({
        env: { VITE_BASE_PATH: '/' },
        cwd: '/path/that/does/not/exist',
      }),
    ).toBe('/');
  });

  it('loads the repository Pages value used by the Node scripts', () => {
    const basePath = loadPagesBasePath({ env: {} });

    expect(basePath).toBe('/quiz-tsi-next/');
    expect(createPagesFallback(basePath)).toContain(
      'var base = "/quiz-tsi-next/"',
    );
  });
});

describe('Pages fallback generation', () => {
  it('uses the validated base path and preserves query and hash', () => {
    const fallback = createPagesFallback('/quiz-tsi-next/');

    expect(fallback).toContain('var base = "/quiz-tsi-next/"');
    expect(fallback).toContain(
      'relative + window.location.search + window.location.hash',
    );
  });

  it('cannot generate an external redirect target', () => {
    expect(() => createPagesFallback('https://example.com/')).toThrow();

    const fallback = createPagesFallback('/quiz-tsi-next/');
    expect(fallback).toContain('new URL(base, window.location.origin)');
    expect(fallback).not.toContain('window.location.replace("http');
  });
});
