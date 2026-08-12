import { describe, expect, it } from 'vitest';
import {
  circleCandidate,
  straightCandidate,
  toCircleStroke,
  toStraightStroke,
} from '@domain/whiteboard/MagicShapes';
import type {
  WhiteboardPoint,
  WhiteboardStroke,
} from '@domain/whiteboard/WhiteboardScene';

const point = (x: number, y: number, timestamp = x): WhiteboardPoint => ({
  x,
  y,
  timestamp,
  pressure: 0.5,
  tiltX: 0,
  tiltY: 0,
});
const stroke = (points: WhiteboardPoint[]): WhiteboardStroke => ({
  kind: 'stroke',
  id: 'stroke',
  tool: 'pen',
  points,
  width: 3,
  color: '#000',
  createdAt: '2026-08-12T00:00:00.000Z',
});

describe('magic shapes', () => {
  it('recognises and converts a long nearly straight stroke', () => {
    const points = Array.from({ length: 12 }, (_, index) =>
      point(index * 10, index % 2 ? 1 : 0),
    );
    expect(straightCandidate(points)).toBe(true);
    expect(toStraightStroke(stroke(points)).points).toHaveLength(2);
  });

  it('does not snap short handwriting', () => {
    expect(straightCandidate([point(0, 0), point(8, 2), point(15, 0)])).toBe(
      false,
    );
    expect(circleCandidate([point(0, 0), point(8, 2), point(15, 0)])).toBe(
      false,
    );
  });

  it('recognises and converts a closed circular stroke', () => {
    const points = Array.from({ length: 33 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return point(
        100 + Math.cos(angle) * 50,
        100 + Math.sin(angle) * 49,
        index * 10,
      );
    });
    expect(circleCandidate(points)).toBe(true);
    const converted = toCircleStroke(stroke(points));
    expect(converted.points).toHaveLength(49);
    expect(
      Math.hypot(
        converted.points[0]!.x - converted.points.at(-1)!.x,
        converted.points[0]!.y - converted.points.at(-1)!.y,
      ),
    ).toBeLessThan(0.001);
  });

  it('rejects an open arc and a highly curved line', () => {
    const arc = Array.from({ length: 20 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return point(Math.cos(angle) * 50, Math.sin(angle) * 50, index);
    });
    expect(circleCandidate(arc)).toBe(false);
    expect(straightCandidate(arc)).toBe(false);
  });
});
