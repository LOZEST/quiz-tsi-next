export const WHITEBOARD_SHAPE_KINDS = [
  'line',
  'arrow',
  'rectangle',
  'square',
  'circle',
  'triangle',
  'axes',
  'coordinate-system',
  'grid-coordinate-system',
  'graduated-coordinate-system',
  'trigonometric-circle',
  'sign-chart',
] as const;
export type WhiteboardShapeKind = (typeof WHITEBOARD_SHAPE_KINDS)[number];

export const WHITEBOARD_PALETTE_SHAPE_KINDS = [
  'grid-coordinate-system',
  'graduated-coordinate-system',
  'trigonometric-circle',
  'sign-chart',
] as const satisfies readonly WhiteboardShapeKind[];
export type WhiteboardPaletteShapeKind =
  (typeof WHITEBOARD_PALETTE_SHAPE_KINDS)[number];

export interface WhiteboardShapeStyle {
  color: string;
  width: number;
  opacity: number;
  lineCap: 'round' | 'square';
  lineJoin: 'round' | 'bevel' | 'miter';
}

export interface WhiteboardShapeGeometry {
  schemaVersion: 1;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number | null;
  properties: Record<string, never>;
}

export interface WhiteboardShape {
  kind: 'shape';
  id: string;
  shapeKind: WhiteboardShapeKind;
  style: WhiteboardShapeStyle;
  geometry: WhiteboardShapeGeometry;
}

export interface Point2d {
  x: number;
  y: number;
}
export interface ShapeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type ShapePrimitiveRole = 'primary' | 'secondary' | 'faint';
interface ShapePrimitiveAppearance {
  role?: ShapePrimitiveRole;
  widthScale?: number;
  filled?: boolean;
}
export type ShapePrimitive =
  | ({ kind: 'line'; from: Point2d; to: Point2d } & ShapePrimitiveAppearance)
  | ({
      kind: 'polyline';
      points: readonly Point2d[];
      closed: boolean;
    } & ShapePrimitiveAppearance)
  | ({
      kind: 'ellipse';
      center: Point2d;
      radiusX: number;
      radiusY: number;
    } & ShapePrimitiveAppearance)
  | ({
      kind: 'text';
      position: Point2d;
      value: string;
      fontSize: number;
      align: 'start' | 'center' | 'end';
    } & ShapePrimitiveAppearance);

const proportionalKinds = new Set<WhiteboardShapeKind>([
  'square',
  'circle',
  'trigonometric-circle',
]);
const fixedRotationKinds = new Set<WhiteboardShapeKind>([
  'circle',
  'axes',
  'coordinate-system',
  'grid-coordinate-system',
  'graduated-coordinate-system',
  'trigonometric-circle',
]);

export const WHITEBOARD_RESIZE_HANDLE_RADIUS = 16;
export const WHITEBOARD_ROTATION_HANDLE_RADIUS = 14;
export const WHITEBOARD_ROTATION_HANDLE_OFFSET = 24;

export function createShape(
  id: string,
  shapeKind: WhiteboardShapeKind,
  start: Point2d,
  end: Point2d,
  style: WhiteboardShapeStyle,
): WhiteboardShape {
  let width = Math.max(1, Math.abs(end.x - start.x));
  let height = Math.max(1, Math.abs(end.y - start.y));
  if (proportionalKinds.has(shapeKind))
    width = height = Math.max(width, height);
  return {
    kind: 'shape',
    id,
    shapeKind,
    style,
    geometry: {
      schemaVersion: 1,
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width,
      height,
      rotation: fixedRotationKinds.has(shapeKind) ? null : 0,
      properties: {},
    },
  };
}

export const shapeBounds = (shape: WhiteboardShape): ShapeBounds => ({
  x: shape.geometry.x,
  y: shape.geometry.y,
  width: shape.geometry.width,
  height: shape.geometry.height,
});

export function translateShape(
  shape: WhiteboardShape,
  dx: number,
  dy: number,
): WhiteboardShape {
  return {
    ...shape,
    geometry: {
      ...shape.geometry,
      x: shape.geometry.x + dx,
      y: shape.geometry.y + dy,
    },
  };
}

export function resizeShape(
  shape: WhiteboardShape,
  width: number,
  height: number,
): WhiteboardShape {
  let nextWidth = Math.max(1, Math.abs(width));
  let nextHeight = Math.max(1, Math.abs(height));
  if (proportionalKinds.has(shape.shapeKind))
    nextWidth = nextHeight = Math.max(nextWidth, nextHeight);
  return {
    ...shape,
    geometry: { ...shape.geometry, width: nextWidth, height: nextHeight },
  };
}

export function rotateShape(
  shape: WhiteboardShape,
  rotation: number,
): WhiteboardShape {
  if (shape.geometry.rotation === null || !Number.isFinite(rotation))
    return shape;
  return { ...shape, geometry: { ...shape.geometry, rotation } };
}

export function worldPointToShapeLocal(
  shape: WhiteboardShape,
  point: Point2d,
): Point2d {
  const { x, y, width, height, rotation } = shape.geometry;
  const center = { x: x + width / 2, y: y + height / 2 };
  const angle = -(rotation ?? 0);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: Math.cos(angle) * dx - Math.sin(angle) * dy + width / 2,
    y: Math.sin(angle) * dx + Math.cos(angle) * dy + height / 2,
  };
}

export function shapeLocalPointToWorld(
  shape: WhiteboardShape,
  point: Point2d,
): Point2d {
  const { x, y, width, height, rotation } = shape.geometry;
  const center = { x: x + width / 2, y: y + height / 2 };
  const angle = rotation ?? 0;
  const dx = point.x - width / 2;
  const dy = point.y - height / 2;
  return {
    x: Math.cos(angle) * dx - Math.sin(angle) * dy + center.x,
    y: Math.sin(angle) * dx + Math.cos(angle) * dy + center.y,
  };
}

export function resizeHandlePosition(shape: WhiteboardShape): Point2d {
  return shapeLocalPointToWorld(shape, {
    x: shape.geometry.width,
    y: shape.geometry.height,
  });
}

export function rotationHandlePosition(shape: WhiteboardShape): Point2d | null {
  if (shape.geometry.rotation === null) return null;
  return shapeLocalPointToWorld(shape, {
    x: shape.geometry.width / 2,
    y: -WHITEBOARD_ROTATION_HANDLE_OFFSET,
  });
}

export function hitTestResizeHandle(
  shape: WhiteboardShape,
  point: Point2d,
  tolerance = WHITEBOARD_RESIZE_HANDLE_RADIUS,
): boolean {
  const handle = resizeHandlePosition(shape);
  return Math.hypot(point.x - handle.x, point.y - handle.y) <= tolerance;
}

export function hitTestRotationHandle(
  shape: WhiteboardShape,
  point: Point2d,
  tolerance = WHITEBOARD_ROTATION_HANDLE_RADIUS,
): boolean {
  const handle = rotationHandlePosition(shape);
  return (
    handle !== null &&
    Math.hypot(point.x - handle.x, point.y - handle.y) <= tolerance
  );
}

export function resizeShapeFromWorldPoint(
  shape: WhiteboardShape,
  point: Point2d,
): WhiteboardShape {
  const anchor = shapeLocalPointToWorld(shape, { x: 0, y: 0 });
  const angle = -(shape.geometry.rotation ?? 0);
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const localWidth = Math.cos(angle) * dx - Math.sin(angle) * dy;
  const localHeight = Math.sin(angle) * dx + Math.cos(angle) * dy;
  const resized = resizeShape(
    shape,
    Math.max(1, localWidth),
    Math.max(1, localHeight),
  );
  const half = {
    x: resized.geometry.width / 2,
    y: resized.geometry.height / 2,
  };
  const rotation = resized.geometry.rotation ?? 0;
  const center = {
    x: anchor.x + Math.cos(rotation) * half.x - Math.sin(rotation) * half.y,
    y: anchor.y + Math.sin(rotation) * half.x + Math.cos(rotation) * half.y,
  };
  return {
    ...resized,
    geometry: {
      ...resized.geometry,
      x: center.x - half.x,
      y: center.y - half.y,
    },
  };
}

const segmentDistance = (point: Point2d, a: Point2d, b: Point2d) => {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared,
          ),
        );
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
};

export function hitTestShape(
  shape: WhiteboardShape,
  point: Point2d,
  tolerance = 8,
): boolean {
  const p = worldPointToShapeLocal(shape, point);
  const { width: w, height: h } = shape.geometry;
  if (
    p.x < -tolerance ||
    p.y < -tolerance ||
    p.x > w + tolerance ||
    p.y > h + tolerance
  )
    return false;
  return shapePrimitives(shape).some((primitive) => {
    if (primitive.kind === 'line')
      return segmentDistance(p, primitive.from, primitive.to) <= tolerance;
    if (primitive.kind === 'polyline') {
      const points = primitive.closed
        ? [...primitive.points, primitive.points[0]!]
        : primitive.points;
      return points
        .slice(1)
        .some(
          (candidate, index) =>
            segmentDistance(p, points[index]!, candidate) <= tolerance,
        );
    }
    if (primitive.kind === 'ellipse') {
      const normalized = Math.hypot(
        (p.x - primitive.center.x) / Math.max(1, primitive.radiusX),
        (p.y - primitive.center.y) / Math.max(1, primitive.radiusY),
      );
      const normalizedTolerance =
        tolerance / Math.max(1, Math.min(primitive.radiusX, primitive.radiusY));
      return primitive.filled
        ? normalized <= 1 + normalizedTolerance
        : Math.abs(normalized - 1) <= normalizedTolerance;
    }
    const estimatedWidth = primitive.value.length * primitive.fontSize * 0.55;
    const start =
      primitive.align === 'center'
        ? primitive.position.x - estimatedWidth / 2
        : primitive.align === 'end'
          ? primitive.position.x - estimatedWidth
          : primitive.position.x;
    return (
      p.x >= start - tolerance &&
      p.x <= start + estimatedWidth + tolerance &&
      Math.abs(p.y - primitive.position.y) <= primitive.fontSize / 2 + tolerance
    );
  });
}

const arrowHead = (
  tip: Point2d,
  angle: number,
  size: number,
): ShapePrimitive => ({
  kind: 'polyline',
  points: [
    {
      x: tip.x - Math.cos(angle - Math.PI / 6) * size,
      y: tip.y - Math.sin(angle - Math.PI / 6) * size,
    },
    tip,
    {
      x: tip.x - Math.cos(angle + Math.PI / 6) * size,
      y: tip.y - Math.sin(angle + Math.PI / 6) * size,
    },
  ],
  closed: false,
});

function gridCoordinateSystemPrimitives(
  w: number,
  h: number,
): ShapePrimitive[] {
  const left = w * 0.06;
  const right = w * 0.94;
  const top = h * 0.08;
  const bottom = h * 0.92;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const primitives: ShapePrimitive[] = [];
  for (let index = 0; index <= 20; index += 1) {
    const x = left + ((right - left) * index) / 20;
    primitives.push({
      kind: 'line',
      from: { x, y: top },
      to: { x, y: bottom },
      role: 'faint',
      widthScale: 0.42,
    });
  }
  for (let index = 0; index <= 16; index += 1) {
    const y = top + ((bottom - top) * index) / 16;
    primitives.push({
      kind: 'line',
      from: { x: left, y },
      to: { x: right, y },
      role: 'faint',
      widthScale: 0.42,
    });
  }
  const axisSize = Math.max(5, Math.min(w, h) * 0.025);
  primitives.push(
    {
      kind: 'line',
      from: { x: w * 0.015, y: centerY },
      to: { x: w * 0.985, y: centerY },
    },
    {
      kind: 'line',
      from: { x: centerX, y: h * 0.015 },
      to: { x: centerX, y: h * 0.985 },
    },
    arrowHead({ x: w * 0.985, y: centerY }, 0, axisSize),
    arrowHead({ x: w * 0.015, y: centerY }, Math.PI, axisSize),
    arrowHead({ x: centerX, y: h * 0.015 }, -Math.PI / 2, axisSize),
    arrowHead({ x: centerX, y: h * 0.985 }, Math.PI / 2, axisSize),
    {
      kind: 'text',
      position: { x: w * 0.965, y: centerY - axisSize * 1.35 },
      value: 'x',
      fontSize: Math.max(10, h * 0.07),
      align: 'center',
    },
    {
      kind: 'text',
      position: { x: centerX + axisSize * 1.35, y: h * 0.04 },
      value: 'y',
      fontSize: Math.max(10, h * 0.07),
      align: 'start',
    },
  );
  return primitives;
}

function graduatedCoordinateSystemPrimitives(
  w: number,
  h: number,
): ShapePrimitive[] {
  const left = w * 0.04;
  const right = w * 0.96;
  const top = h * 0.08;
  const bottom = h * 0.92;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const xStep = (right - left) / 12;
  const yStep = (bottom - top) / 10;
  const fontSize = Math.max(7, Math.min(w / 38, h / 15));
  const dotRadius = Math.max(0.9, Math.min(w, h) * 0.005);
  const primitives: ShapePrimitive[] = [];
  for (let xIndex = 0; xIndex <= 12; xIndex += 1) {
    for (let yIndex = 0; yIndex <= 10; yIndex += 1) {
      primitives.push({
        kind: 'ellipse',
        center: {
          x: left + xIndex * xStep,
          y: top + yIndex * yStep,
        },
        radiusX: dotRadius,
        radiusY: dotRadius,
        role: 'faint',
        filled: true,
      });
    }
  }
  primitives.push(
    { kind: 'line', from: { x: 0, y: centerY }, to: { x: w, y: centerY } },
    { kind: 'line', from: { x: centerX, y: 0 }, to: { x: centerX, y: h } },
  );
  for (let value = -6; value <= 6; value += 1) {
    const x = centerX + value * xStep;
    primitives.push({
      kind: 'ellipse',
      center: { x, y: centerY },
      radiusX: dotRadius * 1.35,
      radiusY: dotRadius * 1.35,
      role: 'secondary',
      filled: true,
    });
    if (value !== 0)
      primitives.push({
        kind: 'text',
        position: { x, y: centerY + fontSize * 1.15 },
        value: String(value),
        fontSize,
        align: 'center',
        role: 'secondary',
      });
  }
  for (let half = -5; half <= 5; half += 1) {
    const value = half / 2;
    const y = centerY - half * yStep;
    primitives.push({
      kind: 'ellipse',
      center: { x: centerX, y },
      radiusX: dotRadius * 1.35,
      radiusY: dotRadius * 1.35,
      role: 'secondary',
      filled: true,
    });
    if (value !== 0)
      primitives.push({
        kind: 'text',
        position: { x: centerX - fontSize * 0.75, y },
        value: Number.isInteger(value) ? String(value) : value.toFixed(1),
        fontSize,
        align: 'end',
        role: 'secondary',
      });
  }
  primitives.push({
    kind: 'text',
    position: { x: centerX - fontSize * 0.5, y: centerY + fontSize * 1.1 },
    value: 'O',
    fontSize: fontSize * 1.2,
    align: 'end',
  });
  return primitives;
}

function trigonometricCirclePrimitives(w: number, h: number) {
  const center = { x: w * 0.44, y: h * 0.57 };
  const radius = Math.min(w, h) * 0.3;
  const fontSize = Math.max(10, Math.min(w, h) * 0.055);
  const curvedArrow: Point2d[] = Array.from({ length: 9 }, (_, index) => {
    const angle = (20 + index * 10) * (Math.PI / 180);
    return {
      x: center.x + Math.cos(angle) * radius * 1.42,
      y: center.y - Math.sin(angle) * radius * 1.42,
    };
  });
  const arrowTip = curvedArrow.at(-1)!;
  const previous = curvedArrow.at(-2)!;
  return [
    {
      kind: 'ellipse' as const,
      center,
      radiusX: radius,
      radiusY: radius,
    },
    {
      kind: 'line' as const,
      from: { x: w * 0.05, y: center.y },
      to: { x: w * 0.92, y: center.y },
    },
    {
      kind: 'line' as const,
      from: { x: center.x, y: h * 0.04 },
      to: { x: center.x, y: h * 0.97 },
    },
    arrowHead({ x: center.x + radius, y: center.y }, 0, fontSize * 0.7),
    arrowHead(
      { x: center.x, y: center.y - radius },
      -Math.PI / 2,
      fontSize * 0.7,
    ),
    {
      kind: 'polyline' as const,
      points: curvedArrow,
      closed: false,
    },
    arrowHead(
      arrowTip,
      Math.atan2(arrowTip.y - previous.y, arrowTip.x - previous.x),
      fontSize * 0.75,
    ),
    {
      kind: 'text' as const,
      position: {
        x: center.x - fontSize * 0.55,
        y: center.y - fontSize * 0.65,
      },
      value: 'O',
      fontSize: fontSize * 1.15,
      align: 'end' as const,
    },
    {
      kind: 'text' as const,
      position: {
        x: center.x + radius + fontSize * 0.5,
        y: center.y + fontSize,
      },
      value: 'I',
      fontSize,
      align: 'center' as const,
    },
    {
      kind: 'text' as const,
      position: {
        x: center.x - fontSize * 0.45,
        y: center.y - radius - fontSize * 0.7,
      },
      value: 'J',
      fontSize,
      align: 'center' as const,
    },
    {
      kind: 'text' as const,
      position: { x: w * 0.14, y: h * 0.28 },
      value: 'C',
      fontSize: fontSize * 1.15,
      align: 'center' as const,
    },
    {
      kind: 'text' as const,
      position: { x: w * 0.75, y: h * 0.18 },
      value: 'sens direct',
      fontSize: fontSize * 0.86,
      align: 'center' as const,
    },
  ] satisfies readonly ShapePrimitive[];
}

function variationChartPrimitives(w: number, h: number) {
  const dividerX = w * 0.27;
  const firstRow = h * 0.17;
  const secondRow = h * 0.39;
  const fontSize = Math.max(9, Math.min(w / 28, h / 11));
  return [
    {
      kind: 'polyline' as const,
      points: [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ],
      closed: true,
    },
    {
      kind: 'line' as const,
      from: { x: dividerX, y: 0 },
      to: { x: dividerX, y: h },
    },
    {
      kind: 'line' as const,
      from: { x: 0, y: firstRow },
      to: { x: w, y: firstRow },
    },
    {
      kind: 'line' as const,
      from: { x: 0, y: secondRow },
      to: { x: w, y: secondRow },
    },
    {
      kind: 'text' as const,
      position: { x: dividerX / 2, y: firstRow / 2 },
      value: 'x',
      fontSize,
      align: 'center' as const,
    },
    {
      kind: 'text' as const,
      position: { x: dividerX / 2, y: (firstRow + secondRow) / 2 },
      value: "signe de f'(x)",
      fontSize: fontSize * 0.78,
      align: 'center' as const,
    },
    {
      kind: 'text' as const,
      position: { x: dividerX / 2, y: (secondRow + h) / 2 },
      value: 'variations de f',
      fontSize: fontSize * 0.75,
      align: 'center' as const,
    },
  ] satisfies readonly ShapePrimitive[];
}

export function shapePrimitives(
  shape: WhiteboardShape,
): readonly ShapePrimitive[] {
  const w = shape.geometry.width,
    h = shape.geometry.height;
  if (shape.shapeKind === 'line')
    return [{ kind: 'line', from: { x: 0, y: 0 }, to: { x: w, y: h } }];
  if (shape.shapeKind === 'arrow')
    return [
      { kind: 'line', from: { x: 0, y: 0 }, to: { x: w, y: h } },
      {
        kind: 'polyline',
        points: [
          { x: w - 14, y: h - 4 },
          { x: w, y: h },
          { x: w - 4, y: h - 14 },
        ],
        closed: false,
      },
    ];
  if (shape.shapeKind === 'circle')
    return [
      {
        kind: 'ellipse',
        center: { x: w / 2, y: h / 2 },
        radiusX: w / 2,
        radiusY: h / 2,
      },
    ];
  if (shape.shapeKind === 'triangle')
    return [
      {
        kind: 'polyline',
        points: [
          { x: w / 2, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ],
        closed: true,
      },
    ];
  if (shape.shapeKind === 'rectangle' || shape.shapeKind === 'square')
    return [
      {
        kind: 'polyline',
        points: [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ],
        closed: true,
      },
    ];
  if (shape.shapeKind === 'sign-chart') {
    return variationChartPrimitives(w, h);
  }
  if (shape.shapeKind === 'grid-coordinate-system')
    return gridCoordinateSystemPrimitives(w, h);
  if (shape.shapeKind === 'graduated-coordinate-system')
    return graduatedCoordinateSystemPrimitives(w, h);
  const axes: ShapePrimitive[] = [
    { kind: 'line', from: { x: 0, y: h / 2 }, to: { x: w, y: h / 2 } },
    { kind: 'line', from: { x: w / 2, y: 0 }, to: { x: w / 2, y: h } },
  ];
  if (shape.shapeKind === 'trigonometric-circle')
    return trigonometricCirclePrimitives(w, h);
  if (shape.shapeKind === 'coordinate-system') {
    for (let x = w / 2 + 20; x < w; x += 20)
      axes.push({
        kind: 'line',
        from: { x, y: h / 2 - 3 },
        to: { x, y: h / 2 + 3 },
      });
    for (let y = h / 2 + 20; y < h; y += 20)
      axes.push({
        kind: 'line',
        from: { x: w / 2 - 3, y },
        to: { x: w / 2 + 3, y },
      });
  }
  return axes;
}
