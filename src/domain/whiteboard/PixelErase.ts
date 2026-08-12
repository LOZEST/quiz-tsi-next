import type { WhiteboardPoint, WhiteboardStroke } from './WhiteboardScene';

interface Point2d {
  x: number;
  y: number;
}

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

export function pathContainsPoint(
  path: readonly Point2d[],
  point: Point2d,
  radius: number,
): boolean {
  if (path.length === 0) return false;
  if (path.length === 1)
    return Math.hypot(point.x - path[0]!.x, point.y - path[0]!.y) <= radius;
  return path
    .slice(1)
    .some(
      (candidate, index) =>
        segmentDistance(point, path[index]!, candidate) <= radius,
    );
}

const interpolatePoint = (
  a: WhiteboardPoint,
  b: WhiteboardPoint,
  progress: number,
): WhiteboardPoint => ({
  x: a.x + (b.x - a.x) * progress,
  y: a.y + (b.y - a.y) * progress,
  pressure: a.pressure + (b.pressure - a.pressure) * progress,
  tiltX: a.tiltX + (b.tiltX - a.tiltX) * progress,
  tiltY: a.tiltY + (b.tiltY - a.tiltY) * progress,
  timestamp: a.timestamp + (b.timestamp - a.timestamp) * progress,
});

/** Splits a pen stroke into deterministic surviving fragments. */
export function eraseStrokeWithPath(
  stroke: WhiteboardStroke,
  path: readonly Point2d[],
  radius: number,
): WhiteboardStroke[] {
  if (path.length === 0) return [stroke];
  const samples: WhiteboardPoint[] = [];
  for (let index = 1; index < stroke.points.length; index += 1) {
    const a = stroke.points[index - 1]!;
    const b = stroke.points[index]!;
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(2, radius / 2)),
    );
    if (index === 1) samples.push(a);
    for (let step = 1; step <= steps; step += 1)
      samples.push(interpolatePoint(a, b, step / steps));
  }
  if (stroke.points.length === 1) samples.push(stroke.points[0]!);
  const runs: WhiteboardPoint[][] = [];
  let current: WhiteboardPoint[] = [];
  for (const point of samples) {
    if (pathContainsPoint(path, point, radius + stroke.width / 2)) {
      if (current.length > 0) runs.push(current);
      current = [];
    } else current.push(point);
  }
  if (current.length > 0) runs.push(current);
  if (runs.length === 1 && runs[0]!.length === samples.length) return [stroke];
  return runs
    .filter((run) => run.length > 0)
    .map((points, index) => ({
      ...stroke,
      id: index === 0 ? stroke.id : `${stroke.id}:fragment:${index}`,
      points,
    }));
}
