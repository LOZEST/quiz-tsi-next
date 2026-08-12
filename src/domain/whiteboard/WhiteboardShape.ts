export const WHITEBOARD_SHAPE_KINDS = [
  'line',
  'arrow',
  'rectangle',
  'square',
  'circle',
  'triangle',
  'axes',
  'coordinate-system',
  'trigonometric-circle',
  'sign-chart',
] as const;
export type WhiteboardShapeKind = (typeof WHITEBOARD_SHAPE_KINDS)[number];

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
export type ShapePrimitive =
  | { kind: 'line'; from: Point2d; to: Point2d }
  | { kind: 'polyline'; points: readonly Point2d[]; closed: boolean }
  | { kind: 'ellipse'; center: Point2d; radiusX: number; radiusY: number };

const proportionalKinds = new Set<WhiteboardShapeKind>([
  'square',
  'circle',
  'trigonometric-circle',
]);
const fixedRotationKinds = new Set<WhiteboardShapeKind>([
  'circle',
  'axes',
  'coordinate-system',
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
  if (shape.shapeKind === 'line' || shape.shapeKind === 'arrow')
    return segmentDistance(p, { x: 0, y: 0 }, { x: w, y: h }) <= tolerance;
  if (
    shape.shapeKind === 'circle' ||
    shape.shapeKind === 'trigonometric-circle'
  ) {
    const normalized = Math.hypot(
      (p.x - w / 2) / (w / 2),
      (p.y - h / 2) / (h / 2),
    );
    return (
      Math.abs(normalized - 1) <= tolerance / Math.max(1, w / 2) ||
      (shape.shapeKind === 'trigonometric-circle' &&
        (Math.abs(p.x - w / 2) <= tolerance ||
          Math.abs(p.y - h / 2) <= tolerance))
    );
  }
  if (shape.shapeKind === 'axes' || shape.shapeKind === 'coordinate-system')
    return (
      Math.abs(p.x - w / 2) <= tolerance || Math.abs(p.y - h / 2) <= tolerance
    );
  if (shape.shapeKind === 'triangle') {
    const edges: [Point2d, Point2d][] = [
      [
        { x: w / 2, y: 0 },
        { x: w, y: h },
      ],
      [
        { x: w, y: h },
        { x: 0, y: h },
      ],
      [
        { x: 0, y: h },
        { x: w / 2, y: 0 },
      ],
    ];
    return edges.some(([a, b]) => segmentDistance(p, a, b) <= tolerance);
  }
  return Math.min(p.x, p.y, Math.abs(p.x - w), Math.abs(p.y - h)) <= tolerance;
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
    const separators = [0.22, 0.45, 0.65, 0.82].map((ratio) => ({
      kind: 'line' as const,
      from: { x: w * ratio, y: 0 },
      to: { x: w * ratio, y: h },
    }));
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
      { kind: 'line', from: { x: 0, y: h / 3 }, to: { x: w, y: h / 3 } },
      {
        kind: 'line',
        from: { x: 0, y: (h * 2) / 3 },
        to: { x: w, y: (h * 2) / 3 },
      },
      ...separators,
    ];
  }
  const axes: ShapePrimitive[] = [
    { kind: 'line', from: { x: 0, y: h / 2 }, to: { x: w, y: h / 2 } },
    { kind: 'line', from: { x: w / 2, y: 0 }, to: { x: w / 2, y: h } },
  ];
  if (shape.shapeKind === 'trigonometric-circle')
    return [
      {
        kind: 'ellipse',
        center: { x: w / 2, y: h / 2 },
        radiusX: w / 2,
        radiusY: h / 2,
      },
      ...axes,
    ];
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
