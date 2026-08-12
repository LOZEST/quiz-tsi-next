import { describe, expect, it } from 'vitest';
import {
  circleCandidate,
  rectangleCandidate,
  straightCandidate,
  toCircleStroke,
  toRectangleStroke,
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
  const rectanglePoints = (clockwise = true, rotation = 0.08) => {
    const corners = [
      { x: -70, y: -45 },
      { x: 70, y: -45 },
      { x: 70, y: 45 },
      { x: -70, y: 45 },
      { x: -70, y: -45 },
    ];
    const ordered = clockwise
      ? corners
      : [corners[0]!, corners[3]!, corners[2]!, corners[1]!, corners[0]!];
    return ordered
      .flatMap((start, side) => {
        const end = ordered[side + 1];
        if (!end) return [];
        return Array.from({ length: 8 }, (_, index) => {
          const progress = index / 8;
          const x = start.x + (end.x - start.x) * progress;
          const y =
            start.y + (end.y - start.y) * progress + (index % 2 ? 1.2 : -0.8);
          return point(
            200 + Math.cos(rotation) * x - Math.sin(rotation) * y,
            180 + Math.sin(rotation) * x + Math.cos(rotation) * y,
            side * 80 + index * 10,
          );
        });
      })
      .concat(
        point(
          200 + Math.cos(rotation) * -70 - Math.sin(rotation) * -45,
          180 + Math.sin(rotation) * -70 + Math.cos(rotation) * -45,
          400,
        ),
      );
  };

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

  it('accepts a circular stroke containing one stationary sample', () => {
    const points = Array.from({ length: 33 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return point(
        100 + Math.cos(angle) * 50,
        100 + Math.sin(angle) * 50,
        index,
      );
    });
    points.splice(12, 0, { ...points[11]!, timestamp: 11.5 });
    expect(circleCandidate(points)).toBe(true);
  });

  it.each([true, false])(
    'recognises and converts an imperfect oriented rectangle (clockwise=%s)',
    (clockwise) => {
      const points = rectanglePoints(clockwise);
      expect(rectangleCandidate(points)).toBe(true);
      expect(circleCandidate(points)).toBe(false);
      const converted = toRectangleStroke(stroke(points));
      expect(converted.points).toHaveLength(5);
      expect(converted.points[0]).toMatchObject({ pressure: 0.5 });
      expect(converted.width).toBe(3);
      expect(
        distanceBetween(converted.points[0]!, converted.points.at(-1)!),
      ).toBeLessThan(0.001);
      const edges = converted.points.slice(1).map((candidate, index) => ({
        x: candidate.x - converted.points[index]!.x,
        y: candidate.y - converted.points[index]!.y,
      }));
      expect(
        Math.abs(edges[0]!.x * edges[1]!.x + edges[0]!.y * edges[1]!.y),
      ).toBeLessThan(0.01);
    },
  );

  it('rejects rectangle false positives', () => {
    const circle = Array.from({ length: 33 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return point(
        100 + Math.cos(angle) * 50,
        100 + Math.sin(angle) * 50,
        index,
      );
    });
    const triangle = [
      point(20, 100),
      point(100, 20),
      point(180, 100),
      point(20, 100),
    ];
    const open = rectanglePoints().slice(0, -6);
    const small = rectanglePoints().map((candidate) =>
      point(candidate.x / 8, candidate.y / 8),
    );
    const ellipse = Array.from({ length: 33 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return point(
        150 + Math.cos(angle) * 110,
        100 + Math.sin(angle) * 28,
        index,
      );
    });
    const letter = Array.from({ length: 18 }, (_, index) =>
      point(
        index < 6 ? 20 : index < 12 ? 20 + (index - 6) * 18 : 110,
        index < 6 ? 20 + index * 18 : index < 12 ? 20 : 20 + (index - 12) * 18,
        index,
      ),
    );
    for (const candidate of [circle, triangle, open, small, ellipse, letter])
      expect(rectangleCandidate(candidate)).toBe(false);
    expect(rectangleCandidate([point(0, 0), point(140, 0)])).toBe(false);
  });

  it('rejects an open arc and a highly curved line', () => {
    const arc = Array.from({ length: 20 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return point(Math.cos(angle) * 50, Math.sin(angle) * 50, index);
    });
    expect(circleCandidate(arc)).toBe(false);
    expect(straightCandidate(arc)).toBe(false);
  });

  it('rejects a full-size loop that remains open at the endpoint', () => {
    const points = Array.from({ length: 33 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return point(
        100 + Math.cos(angle) * 50,
        100 + Math.sin(angle) * 50,
        index,
      );
    });
    points[32] = point(50, 100, 32);
    expect(circleCandidate(points)).toBe(false);
  });

  it('rejects a closed loop with excessive radius variation', () => {
    const points = Array.from({ length: 33 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      const radius = index % 2 === 0 ? 50 : 32;
      return point(
        100 + Math.cos(angle) * radius,
        100 + Math.sin(angle) * radius,
        index,
      );
    });
    expect(circleCandidate(points)).toBe(false);
  });

  it('rejects a circular loop that repeatedly reverses direction', () => {
    const points = Array.from({ length: 33 }, (_, index) => {
      let angle = (index / 32) * Math.PI * 2;
      if (index === 8 || index === 16 || index === 24) angle -= 0.5;
      return point(
        100 + Math.cos(angle) * 50,
        100 + Math.sin(angle) * 50,
        index,
      );
    });
    expect(circleCandidate(points)).toBe(false);
  });
});

const distanceBetween = (a: WhiteboardPoint, b: WhiteboardPoint) =>
  Math.hypot(a.x - b.x, a.y - b.y);
