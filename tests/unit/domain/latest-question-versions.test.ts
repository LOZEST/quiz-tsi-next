import { describe, expect, it } from 'vitest';
import { latestQuestionVersions } from '../../../src/domain/questions/LatestQuestionVersions';
import type { Question } from '../../../src/domain/questions/Question';

const question = (id: string, version: number): Question => ({
  id,
  version,
  source: 'private',
  ownerId: 'owner',
  status: 'draft',
  validated: false,
  provenance: null,
  classification: {
    kind: 'personal',
    courseId: 'course',
    chapterId: null,
    notionId: null,
  },
  type: 'course',
  difficulty: 'standard',
  parameterization: null,
  prompt: [{ kind: 'text', value: `${id} v${version}` }],
  hint: [],
  correction: [
    {
      id: 'step',
      title: null,
      content: [{ kind: 'text', value: 'Correction' }],
    },
  ],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('latestQuestionVersions', () => {
  it('conserve exactement la version numérique maximale de chaque id', () => {
    const q1v1 = question('q1', 1);
    const history = [
      q1v1,
      question('q2', 1),
      question('q1', 3),
      question('q1', 2),
    ];
    const result = latestQuestionVersions(history);

    expect(result.map(({ id, version }) => [id, version])).toEqual([
      ['q1', 3],
      ['q2', 1],
    ]);
    expect(history[0]).toBe(q1v1);
    expect(history).toHaveLength(4);
  });
});
