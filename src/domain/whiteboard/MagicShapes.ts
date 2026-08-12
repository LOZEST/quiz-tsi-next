import type { WhiteboardPoint, WhiteboardStroke } from './WhiteboardScene';

const distance = (a: WhiteboardPoint, b: WhiteboardPoint) =>
  Math.hypot(b.x - a.x, b.y - a.y);

const pathLength = (points: readonly WhiteboardPoint[]) =>
  points
    .slice(1)
    .reduce((sum, point, index) => sum + distance(points[index]!, point), 0);

const bounds = (points: readonly WhiteboardPoint[]) => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

const segmentDistance = (
  point: WhiteboardPoint,
  a: WhiteboardPoint,
  b: WhiteboardPoint,
) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared,
          ),
        );
  return Math.hypot(point.x - (a.x + ratio * dx), point.y - (a.y + ratio * dy));
};

/** Historical Quiz TSI thresholds, expressed in logical canvas pixels. */
export function straightCandidate(points: readonly WhiteboardPoint[]): boolean {
  if (points.length < 2) return false;
  const first = points[0]!;
  const last = points.at(-1)!;
  const span = distance(first, last);
  const length = pathLength(points);
  if (span < 65 || length < 80) return false;
  const box = bounds(points);
  if (Math.max(box.width, box.height) < 65) return false;
  const mean =
    points.reduce(
      (sum, point) => sum + segmentDistance(point, first, last),
      0,
    ) / points.length;
  return mean <= 3.5 && mean / span <= 0.075 && length / span < 1.18;
}

export function toStraightStroke(stroke: WhiteboardStroke): WhiteboardStroke {
  return { ...stroke, points: [stroke.points[0]!, stroke.points.at(-1)!] };
}

export function circleCandidate(points: readonly WhiteboardPoint[]): boolean {
  if (points.length < 8) return false;
  const box = bounds(points);
  const small = Math.min(box.width, box.height);
  const large = Math.max(box.width, box.height);
  if (small < 44 || large / small > 1.28) return false;
  const radius = (box.width + box.height) / 4;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (distance(points[0]!, points.at(-1)!) > Math.max(12, small * 0.3))
    return false;
  const radii = points.map((point) =>
    Math.hypot(point.x - center.x, point.y - center.y),
  );
  const variation =
    radii.reduce((sum, value) => sum + Math.abs(value - radius), 0) /
    (radii.length * radius);
  if (variation > 0.16) return false;
  const circumferenceRatio = pathLength(points) / (2 * Math.PI * radius);
  if (circumferenceRatio < 0.72 || circumferenceRatio > 1.35) return false;
  const angles = points.map((point) =>
    Math.atan2(point.y - center.y, point.x - center.x),
  );
  let travel = 0;
  let reversals = 0;
  let lastDirection = 0;
  for (let index = 1; index < angles.length; index += 1) {
    let delta = angles[index]! - angles[index - 1]!;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    travel += Math.abs(delta);
    const direction = Math.sign(delta);
    if (direction && lastDirection && direction !== lastDirection)
      reversals += 1;
    if (direction) lastDirection = direction;
  }
  return travel >= Math.PI * 1.65 && travel <= Math.PI * 2.7 && reversals <= 2;
}

export function toCircleStroke(stroke: WhiteboardStroke): WhiteboardStroke {
  const box = bounds(stroke.points);
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const radius = (box.width + box.height) / 4;
  const first = stroke.points[0]!;
  const last = stroke.points.at(-1)!;
  const start = Math.atan2(first.y - center.y, first.x - center.x);
  const points = Array.from({ length: 49 }, (_, index) => {
    const progress = index / 48;
    const angle = start + Math.PI * 2 * progress;
    return {
      ...first,
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      pressure: first.pressure + (last.pressure - first.pressure) * progress,
      timestamp:
        first.timestamp + (last.timestamp - first.timestamp) * progress,
    };
  });
  return { ...stroke, points };
}
