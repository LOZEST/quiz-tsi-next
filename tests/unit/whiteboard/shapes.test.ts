import { describe, expect, it } from 'vitest';
import { restoreWhiteboardScene } from '@domain/whiteboard/WhiteboardScene';
import {
  WHITEBOARD_SHAPE_KINDS,
  WHITEBOARD_PALETTE_SHAPE_KINDS,
  createShape,
  hitTestResizeHandle,
  hitTestRotationHandle,
  hitTestShape,
  resizeHandlePosition,
  resizeShape,
  resizeShapeFromWorldPoint,
  rotationHandlePosition,
  rotateShape,
  shapePrimitives,
  shapeLocalPointToWorld,
  translateShape,
  worldPointToShapeLocal,
  type WhiteboardShapeStyle,
} from '@domain/whiteboard/WhiteboardShape';

const style: WhiteboardShapeStyle = {
  color: '#1d1d1f',
  width: 3,
  opacity: 1,
  lineCap: 'round',
  lineJoin: 'round',
};

describe.each(WHITEBOARD_SHAPE_KINDS)('%s shape', (kind) => {
  it('creates, validates, round-trips, restores, renders geometry and hit-tests', () => {
    const shape = createShape(
      `shape-${kind}`,
      kind,
      { x: 10, y: 20 },
      { x: 110, y: 100 },
      style,
    );
    const restored = restoreWhiteboardScene({
      schemaVersion: 4,
      sceneId: 's',
      questionInstanceId: 'q',
      logicalWidth: 1024,
      logicalHeight: 768,
      objects: [shape],
      updatedAt: '2026-08-10T00:00:00.000Z',
    });
    expect(restored.quarantine).toEqual([]);
    expect(restored.scene.objects[0]).toEqual(shape);
    expect(shapePrimitives(shape).length).toBeGreaterThan(0);
    const primitive = shapePrimitives(shape)[0]!;
    const point =
      primitive.kind === 'line'
        ? {
            x: shape.geometry.x + primitive.from.x,
            y: shape.geometry.y + primitive.from.y,
          }
        : primitive.kind === 'ellipse'
          ? {
              x: shape.geometry.x + primitive.center.x + primitive.radiusX,
              y: shape.geometry.y + primitive.center.y,
            }
          : primitive.kind === 'polyline'
            ? {
                x: shape.geometry.x + primitive.points[0]!.x,
                y: shape.geometry.y + primitive.points[0]!.y,
              }
            : {
                x: shape.geometry.x + primitive.position.x,
                y: shape.geometry.y + primitive.position.y,
              };
    expect(hitTestShape(shape, point)).toBe(true);
  });
});

it('renders the empty variation chart template without invented separators or values', () => {
  const shape = createShape(
    'sign-chart',
    'sign-chart',
    { x: 0, y: 0 },
    { x: 300, y: 180 },
    style,
  );
  const primitives = shapePrimitives(shape);
  expect(primitives).toHaveLength(7);
  expect(primitives).toContainEqual({
    kind: 'line',
    from: { x: 81, y: 0 },
    to: { x: 81, y: 180 },
  });
  expect(primitives).toContainEqual({
    kind: 'line',
    from: { x: 0, y: 30.6 },
    to: { x: 300, y: 30.6 },
  });
  expect(primitives.filter(({ kind }) => kind === 'line')).toHaveLength(3);
  expect(
    primitives
      .filter((primitive) => primitive.kind === 'text')
      .map((primitive) => primitive.value),
  ).toEqual(['x', "signe de f'(x)", 'variations de f']);
  expect(JSON.stringify(primitives)).not.toMatch(/[+−-](?:∞|\d)|flèche/i);
});

it('defines exactly the four user-facing mathematical shapes', () => {
  expect(WHITEBOARD_PALETTE_SHAPE_KINDS).toEqual([
    'grid-coordinate-system',
    'graduated-coordinate-system',
    'trigonometric-circle',
    'sign-chart',
  ]);
});

it('builds a dense regular grid with centered arrowed axes and x/y labels', () => {
  const primitives = shapePrimitives(
    createShape(
      'grid',
      'grid-coordinate-system',
      { x: 0, y: 0 },
      { x: 320, y: 200 },
      style,
    ),
  );
  expect(
    primitives.filter(
      (primitive) => primitive.kind === 'line' && primitive.role === 'faint',
    ),
  ).toHaveLength(38);
  expect(
    primitives
      .filter((primitive) => primitive.kind === 'text')
      .map((primitive) => primitive.value),
  ).toEqual(['x', 'y']);
  expect(primitives.filter(({ kind }) => kind === 'polyline')).toHaveLength(4);
});

it('builds a graduated coordinate system with numeric axes and a dotted grid', () => {
  const primitives = shapePrimitives(
    createShape(
      'graduated',
      'graduated-coordinate-system',
      { x: 0, y: 0 },
      { x: 360, y: 220 },
      style,
    ),
  );
  expect(
    primitives.filter(
      (primitive) => primitive.kind === 'ellipse' && primitive.filled,
    ).length,
  ).toBeGreaterThanOrEqual(160);
  const labels = primitives
    .filter((primitive) => primitive.kind === 'text')
    .map((primitive) => primitive.value);
  expect(labels).toEqual(
    expect.arrayContaining(['-6', '6', '-2.5', '2.5', 'O']),
  );
});

it('builds a trigonometric circle with O, I, J and the direct direction', () => {
  const primitives = shapePrimitives(
    createShape(
      'trigonometric',
      'trigonometric-circle',
      { x: 0, y: 0 },
      { x: 240, y: 240 },
      style,
    ),
  );
  expect(primitives.some(({ kind }) => kind === 'ellipse')).toBe(true);
  expect(
    primitives
      .filter((primitive) => primitive.kind === 'text')
      .map((primitive) => primitive.value),
  ).toEqual(['O', 'I', 'J', 'C', 'sens direct']);
});

it('migrates V1 idempotently, preserves strokes and quarantines only an invalid shape', () => {
  const stroke = {
    kind: 'stroke',
    id: 'stroke',
    tool: 'pen',
    points: [{ x: 1, y: 2, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: 1 }],
    width: 3,
    color: '#000',
    createdAt: '2026-08-10T00:00:00.000Z',
  };
  const first = restoreWhiteboardScene({
    schemaVersion: 1,
    sceneId: 's',
    questionInstanceId: 'q',
    logicalWidth: 1024,
    logicalHeight: 768,
    objects: [stroke],
    updatedAt: '2026-08-10T00:00:00.000Z',
  });
  const second = restoreWhiteboardScene(first.scene);
  expect(first.scene.schemaVersion).toBe(4);
  expect(second.scene).toEqual(first.scene);
  expect(second.scene.objects).toEqual([stroke]);
  const mixed = restoreWhiteboardScene({
    ...first.scene,
    objects: [stroke, { kind: 'shape', id: 'bad' }],
  });
  expect(mixed.scene.objects).toEqual([stroke]);
  expect(mixed.quarantine).toHaveLength(1);
});

it('migrates a V2 scene idempotently and preserves every historical shape kind', () => {
  const historicalKinds = WHITEBOARD_SHAPE_KINDS.filter(
    (kind) => !WHITEBOARD_PALETTE_SHAPE_KINDS.includes(kind as never),
  );
  const historicalShapes = historicalKinds.map((kind, index) =>
    createShape(
      `historical-${kind}`,
      kind,
      { x: index * 5, y: index * 4 },
      { x: index * 5 + 120, y: index * 4 + 90 },
      style,
    ),
  );
  const first = restoreWhiteboardScene({
    schemaVersion: 2,
    sceneId: 'legacy-v2',
    questionInstanceId: 'q',
    logicalWidth: 1024,
    logicalHeight: 768,
    objects: historicalShapes,
    updatedAt: '2026-08-10T00:00:00.000Z',
  });
  const second = restoreWhiteboardScene(first.scene);
  expect(first.quarantine).toEqual([]);
  expect(first.scene.schemaVersion).toBe(4);
  expect(first.scene.objects).toEqual(historicalShapes);
  expect(second).toEqual({ scene: first.scene, quarantine: [] });
});

it('migrates a V3 scene to V4 without changing its content', () => {
  const shape = createShape(
    'v3-shape',
    'trigonometric-circle',
    { x: 10, y: 20 },
    { x: 210, y: 220 },
    style,
  );
  const source = {
    schemaVersion: 3,
    sceneId: 'legacy-v3',
    questionInstanceId: 'q',
    logicalWidth: 1024,
    logicalHeight: 768,
    objects: [shape],
    updatedAt: '2026-08-11T00:00:00.000Z',
  };
  const migrated = restoreWhiteboardScene(source);
  expect(migrated.scene.schemaVersion).toBe(4);
  expect(migrated.scene.objects).toEqual(source.objects);
  expect(restoreWhiteboardScene(migrated.scene)).toEqual({
    scene: migrated.scene,
    quarantine: [],
  });
});

it('translates, resizes and rotates shapes without touching proportional invariants', () => {
  const square = createShape(
    'square',
    'square',
    { x: 0, y: 0 },
    { x: 10, y: 20 },
    style,
  );
  expect(square.geometry.width).toBe(square.geometry.height);
  expect(resizeShape(square, 30, 50).geometry).toMatchObject({
    width: 50,
    height: 50,
  });
  expect(translateShape(square, 4, 5).geometry).toMatchObject({ x: 4, y: 5 });
  expect(rotateShape(square, Math.PI / 2).geometry.rotation).toBe(Math.PI / 2);
  const circle = createShape(
    'circle',
    'circle',
    { x: 0, y: 0 },
    { x: 20, y: 20 },
    style,
  );
  expect(rotateShape(circle, 1)).toBe(circle);
});

it('shares exact local/world handle geometry and resizes rotated shapes from world input', () => {
  const shape = rotateShape(
    createShape(
      'rotated',
      'rectangle',
      { x: 100, y: 100 },
      { x: 220, y: 180 },
      style,
    ),
    Math.PI / 4,
  );
  const local = { x: 37, y: 19 };
  const world = shapeLocalPointToWorld(shape, local);
  expect(worldPointToShapeLocal(shape, world).x).toBeCloseTo(local.x);
  expect(worldPointToShapeLocal(shape, world).y).toBeCloseTo(local.y);
  expect(hitTestResizeHandle(shape, resizeHandlePosition(shape))).toBe(true);
  expect(hitTestRotationHandle(shape, rotationHandlePosition(shape)!)).toBe(
    true,
  );
  const target = shapeLocalPointToWorld(shape, { x: 180, y: 130 });
  const resized = resizeShapeFromWorldPoint(shape, target);
  expect(resized.geometry.width).toBeCloseTo(180);
  expect(resized.geometry.height).toBeCloseTo(130);
  expect(resizeHandlePosition(resized).x).toBeCloseTo(target.x);
  expect(resizeHandlePosition(resized).y).toBeCloseTo(target.y);
});
