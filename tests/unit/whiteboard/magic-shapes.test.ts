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

  it('recognises a straight line sampled at real-stylus density', () => {
    // A mouse (and the sparse fixture above) produces a handful of evenly
    // spaced points. A real Apple Pencil samples far more densely, and any
    // per-sample jitter accumulates into the summed path length as extra
    // "coastline" -- enough to have silently pushed length/span past the
    // straight-line threshold on real devices while every mouse-shaped
    // fixture kept passing.
    const samples = 200;
    const points = Array.from({ length: samples }, (_, index) => {
      const progress = index / (samples - 1);
      const eased = progress - Math.sin(2 * Math.PI * progress) / (2 * Math.PI);
      const jitter = index % 2 ? 1.5 : -1.5;
      return point(eased * 300, jitter, index * 6);
    });
    expect(straightCandidate(points)).toBe(true);
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

  it('recognises a circle sampled at real-stylus density with radial jitter', () => {
    // Same "coastline" problem as the straight-line case above: at 300
    // samples, alternating the radius by a single pixel used to inflate
    // the summed path length (and thus circumferenceRatio) well past the
    // circle threshold, even though the shape itself is a clean circle.
    const samples = 300;
    const points = Array.from({ length: samples }, (_, index) => {
      const angle = (index / (samples - 1)) * Math.PI * 2;
      const radius = 50 + (index % 2 ? 1 : -1);
      return point(
        100 + Math.cos(angle) * radius,
        100 + Math.sin(angle) * radius,
        index * 4,
      );
    });
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

  it('recognises a rectangle sampled at real-stylus density with corner dwelling', () => {
    // A real hand decelerates into and lingers at each corner, so a
    // physical stylus produces far more points per corner than along a
    // side's straight middle -- unlike the evenly time-spaced fixture
    // above. That dwelling made the per-point nearest-side pick flicker
    // between the two adjacent sides purely from sub-pixel jitter right at
    // the bisector, which used to blow the side-sequence "changes" count
    // (see CORNER_HYSTERESIS in MagicShapes.ts) well past the erratic-path
    // rejection threshold and silently break rectangle recognition on real
    // devices while every mouse-shaped fixture kept passing.
    const corners = [
      { x: -70, y: -45 },
      { x: 70, y: -45 },
      { x: 70, y: 45 },
      { x: -70, y: 45 },
      { x: -70, y: -45 },
    ];
    const points: WhiteboardPoint[] = [];
    let timestamp = 0;
    for (let side = 0; side < 4; side += 1) {
      const start = corners[side]!;
      const end = corners[side + 1]!;
      for (let index = 0; index < 40; index += 1) {
        const progress = index / 39;
        const eased =
          progress - Math.sin(2 * Math.PI * progress) / (2 * Math.PI);
        const jitter = index % 2 ? 2 : -1.5;
        points.push(
          point(
            200 + start.x + (end.x - start.x) * eased,
            180 + start.y + (end.y - start.y) * eased + jitter,
            timestamp,
          ),
        );
        timestamp += 8;
      }
    }
    expect(rectangleCandidate(points)).toBe(true);
  });

  it('still rejects a real-density, corner-dwelling triangle as a rectangle', () => {
    const size = 90;
    const corners = [
      { x: 0, y: -size },
      { x: size * 0.87, y: size * 0.5 },
      { x: -size * 0.87, y: size * 0.5 },
      { x: 0, y: -size },
    ];
    const points: WhiteboardPoint[] = [];
    let timestamp = 0;
    for (let side = 0; side < 3; side += 1) {
      const start = corners[side]!;
      const end = corners[side + 1]!;
      for (let index = 0; index < 50; index += 1) {
        const progress = index / 49;
        const eased =
          progress - Math.sin(2 * Math.PI * progress) / (2 * Math.PI);
        const jitter = index % 2 ? 1 : -0.7;
        points.push(
          point(
            150 + start.x + (end.x - start.x) * eased + jitter,
            150 + start.y + (end.y - start.y) * eased + jitter,
            timestamp,
          ),
        );
        timestamp += 8;
      }
    }
    expect(rectangleCandidate(points)).toBe(false);
  });

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
