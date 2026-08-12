import { describe, expect, it } from 'vitest';
import { restoreWhiteboardScene } from '@domain/whiteboard/WhiteboardScene';
import {
  WHITEBOARD_SHAPE_KINDS,
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
      schemaVersion: 2,
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
              x: shape.geometry.x + shape.geometry.width,
              y: shape.geometry.y + shape.geometry.height / 2,
            }
          : {
              x: shape.geometry.x + primitive.points[0]!.x,
              y: shape.geometry.y + primitive.points[0]!.y,
            };
    expect(hitTestShape(shape, point)).toBe(true);
  });
});

it('renders a sign chart as a usable mathematical grid, not a rectangle', () => {
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
    from: { x: 66, y: 0 },
    to: { x: 66, y: 180 },
  });
  expect(primitives).toContainEqual({
    kind: 'line',
    from: { x: 0, y: 60 },
    to: { x: 300, y: 60 },
  });
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
  expect(first.scene.schemaVersion).toBe(2);
  expect(second.scene).toEqual(first.scene);
  expect(second.scene.objects).toEqual([stroke]);
  const mixed = restoreWhiteboardScene({
    ...first.scene,
    objects: [stroke, { kind: 'shape', id: 'bad' }],
  });
  expect(mixed.scene.objects).toEqual([stroke]);
  expect(mixed.quarantine).toHaveLength(1);
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
