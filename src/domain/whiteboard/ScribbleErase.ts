import type { WhiteboardObject, WhiteboardPoint } from './WhiteboardScene';
import { hitTestShape } from './WhiteboardShape';

interface Point2d {
  x: number;
  y: number;
}

const distance = (a: Point2d, b: Point2d) => Math.hypot(b.x - a.x, b.y - a.y);

const segmentDistance = (point: Point2d, a: Point2d, b: Point2d) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const squared = dx * dx + dy * dy;
  const t =
    squared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared),
        );
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
};

const orientation = (a: Point2d, b: Point2d, c: Point2d) =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));

const intersects = (a: Point2d, b: Point2d, c: Point2d, d: Point2d) =>
  orientation(a, b, c) !== orientation(a, b, d) &&
  orientation(c, d, a) !== orientation(c, d, b);

function boundedPoints(points: readonly WhiteboardPoint[], maximum = 72) {
  const step = Math.max(1, Math.ceil(points.length / maximum));
  const sampled = points.filter((_, index) => index % step === 0);
  if (sampled.at(-1) !== points.at(-1) && points.at(-1))
    sampled.push(points.at(-1)!);
  return sampled;
}

/**
 * Conservative scribble classifier. It combines density, repeated dominant-axis
 * reversals and at least two non-adjacent self intersections. Full analysis is
 * bounded to 72 samples and is intended for pointerUp, never pointerMove.
 */
export function scribbleCandidate(points: readonly WhiteboardPoint[]): boolean {
  if (points.length < 14) return false;
  const sampled = boundedPoints(points);
  const xs = sampled.map((point) => point.x);
  const ys = sampled.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const diagonal = Math.hypot(width, height);
  if (Math.min(width, height) < 12 || diagonal < 34) return false;
  const length = sampled
    .slice(1)
    .reduce((sum, point, index) => sum + distance(sampled[index]!, point), 0);
  if (
    length / diagonal < 4.2 ||
    length / Math.max(1, 2 * (width + height)) < 1.8
  )
    return false;

  const dominant: 'x' | 'y' = width >= height ? 'x' : 'y';
  const reversalNoise = Math.max(2.5, diagonal * 0.018);
  let reversals = 0;
  let previousDirection = 0;
  for (let index = 1; index < sampled.length; index += 1) {
    const delta = sampled[index]![dominant] - sampled[index - 1]![dominant];
    if (Math.abs(delta) < reversalNoise) continue;
    const direction = Math.sign(delta);
    if (previousDirection && direction !== previousDirection) reversals += 1;
    previousDirection = direction;
  }
  if (reversals < 5) return false;

  let crossings = 0;
  for (let first = 0; first < sampled.length - 1; first += 1) {
    for (let second = first + 3; second < sampled.length - 1; second += 1) {
      if (first === 0 && second === sampled.length - 2) continue;
      if (
        intersects(
          sampled[first]!,
          sampled[first + 1]!,
          sampled[second]!,
          sampled[second + 1]!,
        )
      ) {
        crossings += 1;
        if (crossings >= 2) return true;
      }
    }
  }
  return false;
}

function pathHitsStroke(
  path: readonly WhiteboardPoint[],
  object: Extract<WhiteboardObject, { kind: 'stroke' }>,
  tolerance: number,
) {
  let hits = 0;
  const requiredHits = Math.min(3, Math.max(1, object.points.length - 1));
  for (let pathIndex = 1; pathIndex < path.length; pathIndex += 1) {
    const a = path[pathIndex - 1]!;
    const b = path[pathIndex]!;
    for (
      let objectIndex = 1;
      objectIndex < object.points.length;
      objectIndex += 1
    ) {
      const c = object.points[objectIndex - 1]!;
      const d = object.points[objectIndex]!;
      if (
        intersects(a, b, c, d) ||
        segmentDistance(a, c, d) <= tolerance + object.width / 2 ||
        segmentDistance(b, c, d) <= tolerance + object.width / 2
      ) {
        hits += 1;
        if (hits >= requiredHits) return true;
      }
    }
  }
  return false;
}

function pathHitsShape(
  path: readonly WhiteboardPoint[],
  object: Extract<WhiteboardObject, { kind: 'shape' }>,
  tolerance: number,
) {
  let hits = 0;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1]!;
    const b = path[index]!;
    const steps = Math.max(
      1,
      Math.ceil(distance(a, b) / Math.max(4, tolerance)),
    );
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps;
      if (
        hitTestShape(
          object,
          { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress },
          tolerance,
        )
      ) {
        hits += 1;
        if (hits >= 2) return true;
      }
    }
  }
  return false;
}

export function scribbleTargetIds(
  points: readonly WhiteboardPoint[],
  objects: readonly WhiteboardObject[],
  tolerance = 7,
): string[] {
  const path = boundedPoints(points);
  return objects.flatMap((object) => {
    if (object.kind === 'eraser-mask') return [];
    const hit =
      object.kind === 'stroke'
        ? pathHitsStroke(path, object, tolerance)
        : pathHitsShape(path, object, tolerance);
    return hit ? [object.id] : [];
  });
}
