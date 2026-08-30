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

interface RectangleFit {
  angle: number;
  center: { x: number; y: number };
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const rotate = (
  point: Pick<WhiteboardPoint, 'x' | 'y'>,
  angle: number,
  center: { x: number; y: number },
) => {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: Math.cos(angle) * dx - Math.sin(angle) * dy,
    y: Math.sin(angle) * dx + Math.cos(angle) * dy,
  };
};

const convexHull = (points: readonly WhiteboardPoint[]) => {
  const unique = [
    ...new Map(
      points.map((point) => [`${point.x}:${point.y}`, point]),
    ).values(),
  ].sort((a, b) => a.x - b.x || a.y - b.y);
  if (unique.length <= 2) return unique;
  const cross = (a: WhiteboardPoint, b: WhiteboardPoint, c: WhiteboardPoint) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lower: WhiteboardPoint[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0)
      lower.pop();
    lower.push(point);
  }
  const upper: WhiteboardPoint[] = [];
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0)
      upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

// A mouse produces a handful of points; a real stylus samples at a much
// higher and more variable rate (denser still wherever the hand slows down,
// e.g. every corner of a rectangle). Any metric that *sums* per-point noise
// -- a summed path length, an accumulated turn angle -- grows with the
// sample count even though the true geometry hasn't changed: the same
// sub-pixel jitter integrated over hundreds of extra samples can inflate a
// path length past a threshold tuned on a sparse, clean, mouse-drawn
// stroke. Bounding those computations to an evenly strided subset keeps
// their behaviour independent of the input device's sampling rate.
const boundedSample = (points: readonly WhiteboardPoint[], cap = 128) =>
  points.filter(
    (_, index) => index % Math.max(1, Math.ceil(points.length / cap)) === 0,
  );

function fitRectangle(points: readonly WhiteboardPoint[]): RectangleFit | null {
  if (points.length < 4) return null;
  const sampled = boundedSample(points);
  const hull = convexHull(sampled);
  if (hull.length < 4) return null;
  const center = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
  let best: (RectangleFit & { area: number }) | null = null;
  for (let index = 0; index < hull.length; index += 1) {
    const a = hull[index]!;
    const b = hull[(index + 1) % hull.length]!;
    const angle = -Math.atan2(b.y - a.y, b.x - a.x);
    const rotated = sampled.map((point) => rotate(point, angle, center));
    const xs = rotated.map((point) => point.x);
    const ys = rotated.map((point) => point.y);
    const candidate = {
      angle,
      center,
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
      area:
        (Math.max(...xs) - Math.min(...xs)) *
        (Math.max(...ys) - Math.min(...ys)),
    };
    if (!best || candidate.area < best.area) best = candidate;
  }
  return best;
}

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
  const analysisPoints = boundedSample(points);
  const length = pathLength(analysisPoints);
  if (span < 65 || length < 80) return false;
  const box = bounds(points);
  if (Math.max(box.width, box.height) < 65) return false;
  const mean =
    analysisPoints.reduce(
      (sum, point) => sum + segmentDistance(point, first, last),
      0,
    ) / analysisPoints.length;
  return mean <= 3.5 && mean / span <= 0.075 && length / span < 1.18;
}

export function toStraightStroke(stroke: WhiteboardStroke): WhiteboardStroke {
  return {
    ...stroke,
    points: [stroke.points[0]!, stroke.points.at(-1)!],
    snap: 'line',
  };
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
  const analysisPoints = boundedSample(points);
  const radii = analysisPoints.map((point) =>
    Math.hypot(point.x - center.x, point.y - center.y),
  );
  const variation =
    radii.reduce((sum, value) => sum + Math.abs(value - radius), 0) /
    (radii.length * radius);
  if (variation > 0.16) return false;
  const circumferenceRatio =
    pathLength(analysisPoints) / (2 * Math.PI * radius);
  if (circumferenceRatio < 0.72 || circumferenceRatio > 1.35) return false;
  const angles = analysisPoints.map((point) =>
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

// How much closer (in logical pixels) a side must be than the one currently
// tracked before the side-sequence walk below accepts a transition to it.
const CORNER_HYSTERESIS = 3;

/**
 * Fits a minimum-area oriented box, then requires a closed path that follows
 * all four sides. Thresholds intentionally favour false negatives: mean edge
 * error <= 7% of the short side, every side >= 12% of samples, and path length
 * within 72–138% of the fitted perimeter.
 */
export function rectangleCandidate(
  points: readonly WhiteboardPoint[],
): boolean {
  if (points.length < 12) return false;
  const fit = fitRectangle(points);
  if (!fit) return false;
  const width = fit.maxX - fit.minX;
  const height = fit.maxY - fit.minY;
  const small = Math.min(width, height);
  const large = Math.max(width, height);
  if (small < 36 || large / small > 6) return false;
  const diagonal = Math.hypot(width, height);
  if (distance(points[0]!, points.at(-1)!) > Math.min(24, diagonal * 0.18))
    return false;
  const analysisPoints = boundedSample(points);
  const perimeter = 2 * (width + height);
  const lengthRatio = pathLength(analysisPoints) / perimeter;
  if (lengthRatio < 0.72 || lengthRatio > 1.38) return false;

  const sideCounts = [0, 0, 0, 0];
  const edgeErrors: number[] = [];
  const sideSequence: number[] = [];
  let trackedSide = -1;
  for (const point of analysisPoints) {
    const local = rotate(point, fit.angle, fit.center);
    const distances = [
      Math.abs(local.y - fit.minY),
      Math.abs(local.x - fit.maxX),
      Math.abs(local.y - fit.maxY),
      Math.abs(local.x - fit.minX),
    ];
    const edge = Math.min(...distances);
    const side = distances.indexOf(edge);
    edgeErrors.push(edge);
    sideCounts[side] = (sideCounts[side] ?? 0) + 1;
    // Near a corner, two adjacent sides sit almost equidistant from the
    // point, so the raw nearest-side pick above flickers back and forth on
    // sub-pixel noise alone -- exactly what a real stylus produces while
    // the hand decelerates into and lingers around a corner. Only accept a
    // transition once the new side is unambiguously closer than the one
    // already being tracked, so dwelling at a corner reads as one steady
    // side instead of dozens of spurious back-and-forth changes below.
    if (trackedSide === -1) trackedSide = side;
    else if (
      side !== trackedSide &&
      distances[trackedSide]! - edge > CORNER_HYSTERESIS
    )
      trackedSide = side;
    if (sideSequence.at(-1) !== trackedSide) sideSequence.push(trackedSide);
  }
  const meanError =
    edgeErrors.reduce((sum, error) => sum + error, 0) / edgeErrors.length;
  if (meanError > Math.max(3.5, small * 0.07)) return false;
  if (sideCounts.some((count) => count / analysisPoints.length < 0.12))
    return false;
  const corners = [
    { x: fit.minX, y: fit.minY },
    { x: fit.maxX, y: fit.minY },
    { x: fit.maxX, y: fit.maxY },
    { x: fit.minX, y: fit.maxY },
  ];
  if (
    corners.some(
      (corner) =>
        Math.min(
          ...analysisPoints.map((point) => {
            const local = rotate(point, fit.angle, fit.center);
            return Math.hypot(local.x - corner.x, local.y - corner.y);
          }),
        ) > Math.max(8, small * 0.13),
    )
  )
    return false;

  const compactSequence = sideSequence.filter(
    (side, index) => index === 0 || side !== sideSequence[index - 1],
  );
  const changes = compactSequence.length - 1;
  if (changes < 3 || changes > 7) return false;
  for (let index = 1; index < compactSequence.length; index += 1) {
    const delta = Math.abs(
      compactSequence[index]! - compactSequence[index - 1]!,
    );
    if (delta === 2) return false;
  }
  return true;
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
  return { ...stroke, points, snap: 'circle' };
}

export function toRectangleStroke(stroke: WhiteboardStroke): WhiteboardStroke {
  const fit = fitRectangle(stroke.points);
  if (!fit) return stroke;
  const localCorners = [
    { x: fit.minX, y: fit.minY },
    { x: fit.maxX, y: fit.minY },
    { x: fit.maxX, y: fit.maxY },
    { x: fit.minX, y: fit.maxY },
  ];
  const toWorld = (point: { x: number; y: number }) => {
    const angle = -fit.angle;
    return {
      x: Math.cos(angle) * point.x - Math.sin(angle) * point.y + fit.center.x,
      y: Math.sin(angle) * point.x + Math.cos(angle) * point.y + fit.center.y,
    };
  };
  const corners = localCorners.map(toWorld);
  const first = stroke.points[0]!;
  const last = stroke.points.at(-1)!;
  const startIndex = corners.reduce(
    (best, corner, index) =>
      Math.hypot(corner.x - first.x, corner.y - first.y) <
      Math.hypot(corners[best]!.x - first.x, corners[best]!.y - first.y)
        ? index
        : best,
    0,
  );
  const signedArea = stroke.points
    .slice(1)
    .reduce(
      (sum, point, index) =>
        sum +
        stroke.points[index]!.x * point.y -
        point.x * stroke.points[index]!.y,
      0,
    );
  const direction = signedArea >= 0 ? 1 : -1;
  const ordered = Array.from(
    { length: 5 },
    (_, index) =>
      corners[
        (startIndex + direction * index + corners.length * 2) % corners.length
      ]!,
  );
  return {
    ...stroke,
    points: ordered.map((corner, index) => {
      const progress = index / 4;
      return {
        ...first,
        ...corner,
        pressure: first.pressure + (last.pressure - first.pressure) * progress,
        tiltX: first.tiltX + (last.tiltX - first.tiltX) * progress,
        tiltY: first.tiltY + (last.tiltY - first.tiltY) * progress,
        timestamp:
          first.timestamp + (last.timestamp - first.timestamp) * progress,
      };
    }),
    snap: 'rectangle',
  };
}
