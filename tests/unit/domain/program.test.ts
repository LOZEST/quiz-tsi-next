import { describe, expect, it } from 'vitest';
import {
  PROGRAM_SCHEMA_VERSION,
  createProgramIndex,
  validateProgram,
  type Program,
} from '@domain/program/Program';

function programFixture(): Program {
  return {
    schemaVersion: PROGRAM_SCHEMA_VERSION,
    parts: [
      { id: 'part-b', label: 'Partie B', order: 1 },
      { id: 'part-a', label: 'Partie A', order: 0 },
    ],
    chapters: [
      { id: 'chapter-c', partId: 'part-a', label: 'Chapitre C', order: 1 },
      { id: 'chapter-b', partId: 'part-a', label: 'Chapitre B', order: 0 },
      { id: 'chapter-a', partId: 'part-a', label: 'Chapitre A', order: 0 },
      { id: 'chapter-d', partId: 'part-b', label: 'Chapitre D', order: 0 },
    ],
    notions: [
      {
        id: 'notion-c',
        chapterId: 'chapter-a',
        label: 'Notion C',
        order: 1,
      },
      {
        id: 'notion-b',
        chapterId: 'chapter-a',
        label: 'Notion B',
        order: 0,
      },
      {
        id: 'notion-a',
        chapterId: 'chapter-a',
        label: 'Notion A',
        order: 0,
      },
      {
        id: 'notion-d',
        chapterId: 'chapter-d',
        label: 'Notion D',
        order: 0,
      },
    ],
  };
}

function issuePaths(value: unknown): string[] {
  const result = validateProgram(value);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.issues.map(({ path }) => path);
}

describe('validateProgram', () => {
  it('normalizes a complete program and strips foreign properties', () => {
    const source = {
      ...programFixture(),
      ignored: true,
      parts: [
        {
          ...programFixture().parts[0],
          ignored: 'part',
        },
        programFixture().parts[1],
      ],
    };
    const result = validateProgram(source);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(programFixture());
    expect(result.value).not.toBe(source);
    expect(result.value.parts).not.toBe(source.parts);
    expect(result.value.parts[0]).not.toBe(source.parts[0]);
    expect(result.value).not.toHaveProperty('ignored');
    expect(result.value.parts[0]).not.toHaveProperty('ignored');
  });

  it('deeply freezes the normalized value without modifying or freezing source', () => {
    const source = structuredClone(programFixture());
    const before = structuredClone(source);
    const result = validateProgram(source);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.parts)).toBe(true);
    expect(Object.isFrozen(result.value.parts[0])).toBe(true);
    expect(Object.isFrozen(result.value.chapters)).toBe(true);
    expect(Object.isFrozen(result.value.chapters[0])).toBe(true);
    expect(Object.isFrozen(result.value.notions)).toBe(true);
    expect(Object.isFrozen(result.value.notions[0])).toBe(true);
    expect(source).toEqual(before);
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(source.parts)).toBe(false);
    expect(Object.isFrozen(source.parts[0])).toBe(false);
  });

  it.each([null, [], 'programme'])('rejects an invalid root: %p', (value) => {
    expect(issuePaths(value)).toContain('program');
  });

  it('rejects incomplete objects and non-array collections', () => {
    expect(issuePaths({})).toEqual(
      expect.arrayContaining([
        'program.schemaVersion',
        'program.parts',
        'program.chapters',
        'program.notions',
      ]),
    );
    expect(
      issuePaths({
        schemaVersion: PROGRAM_SCHEMA_VERSION,
        parts: {},
        chapters: 'chapters',
        notions: null,
      }),
    ).toEqual(
      expect.arrayContaining([
        'program.parts',
        'program.chapters',
        'program.notions',
      ]),
    );
  });

  it('rejects the wrong schema version', () => {
    expect(issuePaths({ ...programFixture(), schemaVersion: 2 })).toContain(
      'program.schemaVersion',
    );
  });

  it('reports duplicate identifiers in every collection', () => {
    const fixture = programFixture();
    expect(
      issuePaths({
        ...fixture,
        parts: [fixture.parts[0], fixture.parts[0]],
        chapters: [fixture.chapters[0], fixture.chapters[0]],
        notions: [fixture.notions[0], fixture.notions[0]],
      }),
    ).toEqual(
      expect.arrayContaining([
        'program.parts.1.id',
        'program.chapters.1.id',
        'program.notions.1.id',
      ]),
    );
  });

  it('rejects orphan chapters and notions with precise paths', () => {
    const fixture = programFixture();
    expect(
      issuePaths({
        ...fixture,
        chapters: [
          ...fixture.chapters,
          {
            id: 'orphan-chapter',
            partId: 'missing-part',
            label: 'Orphelin',
            order: 4,
          },
        ],
        notions: [
          ...fixture.notions,
          {
            id: 'orphan-notion',
            chapterId: 'missing-chapter',
            label: 'Orpheline',
            order: 4,
          },
        ],
      }),
    ).toEqual(
      expect.arrayContaining([
        'program.chapters.4.partId',
        'program.notions.4.chapterId',
      ]),
    );
  });

  it.each([
    ['id', '', 'program.parts.0.id'],
    ['label', ' ', 'program.parts.0.label'],
    ['order', -1, 'program.parts.0.order'],
    ['order', 1.5, 'program.parts.0.order'],
    ['order', Number.NaN, 'program.parts.0.order'],
    ['order', Number.POSITIVE_INFINITY, 'program.parts.0.order'],
  ])('rejects invalid %s values', (field, value, expectedPath) => {
    const fixture = programFixture();
    expect(
      issuePaths({
        ...fixture,
        parts: [{ ...fixture.parts[0], [field]: value }],
      }),
    ).toContain(expectedPath);
  });

  it('collects independent errors with their exact paths', () => {
    const fixture = programFixture();
    const paths = issuePaths({
      schemaVersion: 0,
      parts: [{ id: '', label: '', order: -1 }],
      chapters: [
        {
          id: 'chapter',
          partId: 'missing',
          label: 'Chapitre',
          order: 0,
        },
      ],
      notions: [
        {
          id: 'notion',
          chapterId: 'missing',
          label: 'Notion',
          order: 0,
        },
        fixture.notions[0],
      ],
    });

    expect(paths).toEqual(
      expect.arrayContaining([
        'program.schemaVersion',
        'program.parts.0.id',
        'program.parts.0.label',
        'program.parts.0.order',
        'program.chapters.0.partId',
        'program.notions.0.chapterId',
        'program.notions.1.chapterId',
      ]),
    );
  });

  it('rejects exotic and cyclic roots without throwing', () => {
    const cyclic: Record<string, unknown> = {
      schemaVersion: PROGRAM_SCHEMA_VERSION,
      parts: [],
      chapters: [],
      notions: [],
    };
    cyclic.self = cyclic;
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('hostile');
        },
      },
    );

    expect(() => validateProgram(new Date())).not.toThrow();
    expect(validateProgram(new Date()).ok).toBe(false);
    expect(() => validateProgram(hostile)).not.toThrow();
    expect(validateProgram(hostile).ok).toBe(false);
    expect(() => validateProgram(cyclic)).not.toThrow();
    expect(validateProgram(cyclic).ok).toBe(true);
  });

  it('never introduces general filter options or historical data', () => {
    const result = validateProgram(programFixture());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.value);
    expect(serialized).not.toMatch(
      /Tout|Toutes les parties|Tous les chapitres|Toutes les notions/,
    );
    expect(result.value.notions).toHaveLength(4);
  });
});

describe('createProgramIndex', () => {
  it('indexes all identifiers and returns null for unknown ones', () => {
    const index = createProgramIndex(programFixture());
    expect(index.getPart('part-a')?.label).toBe('Partie A');
    expect(index.getChapter('chapter-a')?.label).toBe('Chapitre A');
    expect(index.getNotion('notion-a')?.label).toBe('Notion A');
    expect(index.getPart('unknown')).toBeNull();
    expect(index.getChapter('unknown')).toBeNull();
    expect(index.getNotion('unknown')).toBeNull();
  });

  it('sorts child collections by order then id', () => {
    const index = createProgramIndex(programFixture());
    expect(index.getChaptersForPart('part-a').map(({ id }) => id)).toEqual([
      'chapter-a',
      'chapter-b',
      'chapter-c',
    ]);
    expect(index.getNotionsForChapter('chapter-a').map(({ id }) => id)).toEqual(
      ['notion-a', 'notion-b', 'notion-c'],
    );
  });

  it('returns immutable arrays and empty arrays for unknown parents', () => {
    const index = createProgramIndex(programFixture());
    expect(Object.isFrozen(index.getChaptersForPart('part-a'))).toBe(true);
    expect(Object.isFrozen(index.getNotionsForChapter('chapter-a'))).toBe(true);
    expect(index.getChaptersForPart('unknown')).toEqual([]);
    expect(index.getNotionsForChapter('unknown')).toEqual([]);
    expect(Object.isFrozen(index.getChaptersForPart('unknown'))).toBe(true);
  });

  it('uses an immutable snapshot independent from its input', () => {
    const fixture = programFixture();
    const source = {
      ...fixture,
      parts: fixture.parts.map((part) => ({ ...part })),
    };
    const index = createProgramIndex(source);
    source.parts[0] = { id: 'changed', label: 'Modifiée', order: 99 };
    expect(index.getPart('part-b')).toEqual({
      id: 'part-b',
      label: 'Partie B',
      order: 1,
    });
    expect(Object.isFrozen(index.getPart('part-b'))).toBe(true);
  });
});
