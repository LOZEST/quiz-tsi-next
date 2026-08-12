import { describe, expect, it } from 'vitest';
import {
  scribbleCandidate,
  scribbleTargetIds,
} from '@domain/whiteboard/ScribbleErase';
import { eraseStrokeWithPath } from '@domain/whiteboard/PixelErase';
import type {
  WhiteboardPoint,
  WhiteboardStroke,
} from '@domain/whiteboard/WhiteboardScene';

const point = (x: number, y: number, timestamp = 0): WhiteboardPoint => ({
  x,
  y,
  timestamp,
  pressure: 0.5,
  tiltX: 0,
  tiltY: 0,
});

const stroke = (id: string, points: WhiteboardPoint[]): WhiteboardStroke => ({
  kind: 'stroke',
  id,
  tool: 'pen',
  points,
  width: 4,
  color: '#123456',
  createdAt: '2026-08-12T00:00:00.000Z',
});

const scribble = (offsetY = 0) =>
  Array.from({ length: 28 }, (_, index) =>
    point(
      index % 2 === 0 ? 20 : 140,
      offsetY + 35 + ((index * 17) % 70),
      index * 8,
    ),
  );

describe('scribble erase domain', () => {
  it('recognises dense crossing scribbles and finds only truly traversed objects', () => {
    const gesture = scribble();
    expect(scribbleCandidate(gesture)).toBe(true);
    expect(
      scribbleCandidate(
        gesture.map((candidate) =>
          point(candidate.y, candidate.x, candidate.timestamp),
        ),
      ),
    ).toBe(true);
    const crossed = stroke('crossed', [point(0, 70), point(170, 70)]);
    const crossedTwice = stroke('crossed-twice', [
      point(0, 90),
      point(170, 90),
    ]);
    const nearby = stroke('nearby', [point(0, 125), point(170, 125)]);
    expect(scribbleTargetIds(gesture, [crossed, crossedTwice, nearby])).toEqual(
      ['crossed', 'crossed-twice'],
    );
  });

  it('rejects handwriting, loops, geometric shapes and simple hatching', () => {
    const circle = Array.from({ length: 33 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return point(80 + Math.cos(angle) * 45, 70 + Math.sin(angle) * 45, index);
    });
    const rectangle = [
      ...Array.from({ length: 10 }, (_, i) => point(20 + i * 10, 20, i)),
      ...Array.from({ length: 8 }, (_, i) => point(110, 20 + i * 8, 10 + i)),
      ...Array.from({ length: 10 }, (_, i) => point(110 - i * 10, 76, 18 + i)),
      ...Array.from({ length: 8 }, (_, i) => point(20, 76 - i * 8, 28 + i)),
    ];
    const sinusoid = Array.from({ length: 30 }, (_, i) =>
      point(i * 5, 60 + Math.sin(i / 2) * 20, i),
    );
    const letterM = [
      point(10, 90),
      point(10, 20),
      point(45, 75),
      point(80, 20),
      point(80, 90),
    ];
    const figureEight = Array.from({ length: 40 }, (_, i) => {
      const angle = (i / 39) * Math.PI * 2;
      return point(80 + Math.sin(angle) * 40, 70 + Math.sin(angle * 2) * 28, i);
    });
    const infinity = Array.from({ length: 40 }, (_, i) => {
      const angle = (i / 39) * Math.PI * 2;
      return point(
        80 + Math.sin(angle) * 45,
        70 + Math.sin(angle) * Math.cos(angle) * 35,
        i,
      );
    });
    const letterE = [
      point(100, 20),
      point(20, 20),
      point(20, 100),
      point(100, 100),
      point(20, 100),
      point(20, 60),
      point(85, 60),
    ];
    const calculation = [
      point(10, 20),
      point(35, 70),
      point(60, 20),
      point(75, 45),
      point(100, 45),
      point(87, 32),
      point(87, 58),
    ];
    const outAndBack = Array.from({ length: 20 }, (_, i) =>
      point(i < 10 ? 20 + i * 10 : 120 - (i - 10) * 10, 40, i),
    );
    const hatching = Array.from({ length: 16 }, (_, i) =>
      point(20 + (i % 2) * 80, 20 + i * 6, i),
    );
    for (const candidate of [
      circle,
      rectangle,
      sinusoid,
      letterM,
      letterE,
      figureEight,
      infinity,
      calculation,
      outAndBack,
      hatching,
    ])
      expect(scribbleCandidate(candidate)).toBe(false);
  });

  it('keeps scribbles in empty space as normal ink targets', () => {
    expect(scribbleCandidate(scribble())).toBe(true);
    expect(scribbleTargetIds(scribble(), [])).toEqual([]);
  });
});

describe('pixel eraser domain', () => {
  it('splits a stroke locally while preserving style and pressure', () => {
    const original = stroke('long', [point(0, 50), point(400, 50, 400)]);
    const fragments = eraseStrokeWithPath(
      original,
      [point(200, 20), point(200, 80)],
      12,
    );
    expect(fragments).toHaveLength(2);
    expect(fragments[0]).toMatchObject({
      id: 'long',
      width: 4,
      color: '#123456',
    });
    expect(fragments[1]).toMatchObject({
      id: 'long:fragment:1',
      width: 4,
      color: '#123456',
    });
    expect(fragments[0]!.points.at(-1)!.x).toBeLessThan(190);
    expect(fragments[1]!.points[0]!.x).toBeGreaterThan(210);
  });

  it('erases the whole continuous interval of a fast eraser movement', () => {
    const original = stroke('long', [point(0, 50), point(400, 50, 400)]);
    const fragments = eraseStrokeWithPath(
      original,
      [point(100, 50), point(300, 50)],
      12,
    );
    expect(fragments).toHaveLength(2);
    expect(fragments[0]!.points.at(-1)!.x).toBeLessThan(90);
    expect(fragments[1]!.points[0]!.x).toBeGreaterThan(310);
  });
});
