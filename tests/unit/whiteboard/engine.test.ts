import { describe, expect, it, vi } from 'vitest';
import { CanvasCoordinates } from '@features/whiteboard/canvas/CanvasCoordinates';
import { CanvasController } from '@features/whiteboard/canvas/CanvasController';
import { CanvasRenderer } from '@features/whiteboard/canvas/CanvasRenderer';
import { GridRenderer } from '@features/whiteboard/canvas/GridRenderer';
import { createStroke } from '@features/whiteboard/model/Stroke';
import { createEmptyScene } from '@features/whiteboard/model/WhiteboardState';
import type { PointerInput } from '@features/whiteboard/model/Point';
import { PenTool } from '@features/whiteboard/tools/PenTool';
import {
  EraserTool,
  objectCollides,
} from '@features/whiteboard/tools/EraserTool';
import { ToolManager } from '@features/whiteboard/tools/ToolManager';
import { restoreWhiteboardScene } from '@domain/whiteboard/WhiteboardScene';
import { pointFromPointerEvent } from '@features/whiteboard/model/Point';
import { snapshotScene } from '@features/whiteboard/model/WhiteboardSnapshot';
import {
  WHITEBOARD_PALETTE_SHAPE_KINDS,
  createShape,
  resizeHandlePosition,
  rotationHandlePosition,
  rotateShape,
  shapePrimitives,
  shapeLocalPointToWorld,
  worldPointToShapeLocal,
  type Point2d,
  type WhiteboardShape,
} from '@domain/whiteboard/WhiteboardShape';

const input = (x: number, y: number, pressure = 0.5): PointerInput => ({
  pointerId: 1,
  pointerType: 'pen',
  point: { x, y, pressure, tiltX: 4, tiltY: -2, timestamp: x + y },
});

describe('CanvasCoordinates', () => {
  it('converts screen coordinates and tracks orientation after resize', () => {
    const coordinates = new CanvasCoordinates();
    expect(coordinates.resize(768, 1024, 2)).toEqual({
      cssWidth: 768,
      cssHeight: 1024,
      pixelRatio: 2,
    });
    expect(coordinates.orientation).toBe('portrait');
    expect(
      coordinates.screenToCanvas(150, 250, new DOMRect(50, 50, 400, 800)),
    ).toEqual({ x: 192, y: 256 });
    coordinates.resize(1024, 768);
    expect(coordinates.orientation).toBe('landscape');
  });
});

describe('pointer input and snapshots', () => {
  it('normalizes mouse pressure and clamps stylus pressure', () => {
    const mouse = {
      pointerType: 'mouse',
      pressure: 0,
      tiltX: 0,
      tiltY: 0,
      timeStamp: 12,
    } as PointerEvent;
    expect(pointFromPointerEvent(mouse, 3, 4)).toEqual({
      x: 3,
      y: 4,
      pressure: 0.5,
      tiltX: 0,
      tiltY: 0,
      timestamp: 12,
    });
    expect(
      pointFromPointerEvent(
        { ...mouse, pointerType: 'pen', pressure: 2 } as PointerEvent,
        0,
        0,
      ).pressure,
    ).toBe(1);
  });

  it('takes an independent scene snapshot', () => {
    const scene = createEmptyScene();
    const snapshot = snapshotScene(scene);
    scene.objects.push(createStroke(input(0, 0).point, 2));
    expect(snapshot.scene.objects).toEqual([]);
  });
});

describe('strokes and tools', () => {
  it('creates a stroke containing pressure and timestamps', () => {
    const stroke = createStroke(
      input(10, 20, 0.8).point,
      4,
      'stroke-1',
      '2026-07-29T00:00:00.000Z',
    );
    expect(stroke).toMatchObject({
      id: 'stroke-1',
      width: 4,
      tool: 'pen',
      points: [{ pressure: 0.8, timestamp: 30 }],
    });
  });

  it('begins, extends and ends a pen stroke', () => {
    const pen = new PenTool(5);
    let scene = pen.begin(createEmptyScene(), input(0, 0)).scene;
    scene = pen.move(scene, input(10, 10)).scene;
    scene = pen.end(scene, input(20, 20)).scene;
    expect(scene.objects).toHaveLength(1);
    expect(scene.objects[0]).toMatchObject({
      kind: 'stroke',
      width: 5,
      points: [{ x: 0 }, { x: 10 }, { x: 20 }],
    });
  });

  it('erases complete strokes by collision instead of painting white', () => {
    const pen = new PenTool();
    let scene = pen.begin(createEmptyScene(), input(0, 0)).scene;
    scene = pen.end(scene, input(100, 0)).scene;
    expect(objectCollides(scene.objects[0]!, 50, 3)).toBe(true);
    const erased = new EraserTool().begin(scene, input(50, 3));
    expect(erased.changed).toBe(true);
    expect(erased.scene.objects).toEqual([]);
  });

  it('changes active tools', () => {
    const manager = new ToolManager({
      pen: new PenTool(),
      eraser: new EraserTool(),
    });
    expect(manager.current.id).toBe('pen');
    manager.select('eraser');
    expect(manager.current.id).toBe('eraser');
  });

  it('handles at least 1000 strokes as scene data', () => {
    const point = input(1, 1).point;
    const objects = Array.from({ length: 1000 }, (_, index) =>
      createStroke(point, 2, `stroke-${index}`),
    );
    expect({ ...createEmptyScene(), objects }.objects).toHaveLength(1000);
  });
});

describe('GridRenderer', () => {
  it('does not draw while disabled and draws while enabled', () => {
    const stroke = vi.fn();
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke,
      set strokeStyle(_: string) {},
      set lineWidth(_: number) {},
    } as unknown as CanvasRenderingContext2D;
    const grid = new GridRenderer(false);
    grid.render(context, 100, 100);
    expect(stroke).not.toHaveBeenCalled();
    grid.enabled = true;
    grid.render(context, 100, 100);
    expect(stroke).toHaveBeenCalled();
  });
});

function createRenderingFixture() {
  const calls = {
    setTransform: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
  };
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: calls.lineTo,
    stroke: vi.fn(),
    clearRect: vi.fn(),
    setTransform: calls.setTransform,
    translate: vi.fn(),
    scale: vi.fn(),
    arc: calls.arc,
    fill: vi.fn(),
    set strokeStyle(_: string) {},
    set fillStyle(_: string) {},
    set lineWidth(_: number) {},
    set lineCap(_: CanvasLineCap) {},
    set lineJoin(_: CanvasLineJoin) {},
  } as unknown as CanvasRenderingContext2D;
  const capturedPointers = new Set<number>();
  const setPointerCapture = vi.fn((pointerId: number) => {
    capturedPointers.add(pointerId);
  });
  const releasePointerCapture = vi.fn((pointerId: number) => {
    capturedPointers.delete(pointerId);
  });
  const hasPointerCapture = vi.fn((pointerId: number) =>
    capturedPointers.has(pointerId),
  );
  const canvas = {
    width: 1024,
    height: 768,
    clientWidth: 1024,
    clientHeight: 768,
    getContext: vi.fn(() => context),
    getBoundingClientRect: vi.fn(() => new DOMRect(0, 0, 1024, 768)),
    setPointerCapture,
    releasePointerCapture,
    hasPointerCapture,
  } as unknown as HTMLCanvasElement;
  return {
    canvas,
    context,
    calls,
    pointerCapture: {
      capturedPointers,
      setPointerCapture,
      releasePointerCapture,
      hasPointerCapture,
    },
  };
}

describe('CanvasRenderer', () => {
  it('renders pressure-sensitive strokes and single-point dots', () => {
    const { canvas, calls } = createRenderingFixture();
    const renderer = new CanvasRenderer(canvas);
    const pen = new PenTool(4);
    let scene = pen.begin(createEmptyScene(), input(2, 3)).scene;
    scene = pen.end(scene, input(20, 30, 0.9)).scene;
    scene = {
      ...scene,
      objects: [...scene.objects, createStroke(input(50, 50).point, 4)],
    };
    renderer.render(scene);
    expect(calls.setTransform).toHaveBeenCalled();
    expect(calls.lineTo).toHaveBeenCalledWith(20, 30);
    expect(calls.arc).toHaveBeenCalled();
  });

  it('schedules, replaces and cancels animation frames', () => {
    const { canvas } = createRenderingFixture();
    const callbacks = new Map<number, FrameRequestCallback>();
    let id = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.set(++id, callback);
      return id;
    });
    const cancel = vi.fn((frame: number) => callbacks.delete(frame));
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const renderer = new CanvasRenderer(canvas);
    renderer.schedule(createEmptyScene());
    renderer.schedule(createEmptyScene());
    expect(cancel).toHaveBeenCalledWith(1);
    callbacks.get(2)?.(0);
    renderer.destroy();
    vi.unstubAllGlobals();
  });
});

describe('CanvasController', () => {
  const pointer = (
    pointerId: number,
    pointerType: 'mouse' | 'pen' | 'touch',
    overrides: Partial<PointerEvent> = {},
  ) =>
    ({
      pointerId,
      pointerType,
      pressure: pointerType === 'mouse' ? 0.5 : 0.7,
      tiltX: 0,
      tiltY: 0,
      timeStamp: 1,
      clientX: 20,
      clientY: 30,
      preventDefault: vi.fn(),
      getCoalescedEvents: () => [],
      ...overrides,
    }) as unknown as PointerEvent;

  function prepareController(
    onCommit: (scene: ReturnType<typeof createEmptyScene>) => void = vi.fn(),
  ) {
    const fixture = createRenderingFixture();
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const controller = new CanvasController(
      fixture.canvas,
      createEmptyScene(),
      onCommit,
    );
    return { controller, ...fixture };
  }

  const shapeStyle = {
    color: '#1d1d1f',
    width: 3,
    opacity: 1,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  };

  function rectangle(rotation = 0) {
    return rotateShape(
      createShape(
        'rectangle',
        'rectangle',
        { x: 100, y: 100 },
        { x: 220, y: 180 },
        shapeStyle,
      ),
      rotation,
    );
  }

  function pointerAt(pointerId: number, point: Point2d) {
    return pointer(pointerId, 'mouse', {
      clientX: point.x,
      clientY: point.y,
    });
  }

  function selectRectangle(
    controller: CanvasController,
    shape: WhiteboardShape,
  ) {
    controller.selectTool('select');
    const body = shapeLocalPointToWorld(shape, {
      x: shape.geometry.width / 2,
      y: 0,
    });
    controller.pointerDown(pointerAt(50, body));
    controller.pointerUp(pointerAt(50, body));
  }

  function moveSelectedRectangle(
    controller: CanvasController,
    shape: WhiteboardShape,
    pointerId: number,
  ) {
    const start = shapeLocalPointToWorld(shape, {
      x: shape.geometry.width / 2,
      y: 0,
    });
    const end = { x: start.x + 30, y: start.y + 20 };
    controller.pointerDown(pointerAt(pointerId, start));
    controller.pointerMove(pointerAt(pointerId, end));
    controller.pointerUp(pointerAt(pointerId, end));
  }

  it('draws, commits, switches tools and supports undo/redo', () => {
    class Observer {
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', Observer);
    const commits: ReturnType<typeof createEmptyScene>[] = [];
    const { controller } = prepareController((scene) => commits.push(scene));
    const mouse = pointer(1, 'mouse');
    controller.setPenWidth(6);
    controller.pointerDown(mouse);
    controller.pointerMove(pointer(1, 'mouse', { clientX: 40 }));
    controller.pointerUp(pointer(1, 'mouse', { clientX: 50 }));
    expect(commits.at(-1)?.objects).toHaveLength(1);
    const drawn = commits.at(-1)?.objects[0];
    expect(drawn?.kind === 'stroke' ? drawn.points : []).toHaveLength(3);
    controller.undo();
    expect(commits.at(-1)?.objects).toEqual([]);
    controller.redo();
    expect(commits.at(-1)?.objects).toHaveLength(1);
    controller.selectTool('eraser');
    expect(controller.getActiveTool()).toBe('eraser');
    controller.setGrid(true);
    controller.replaceScene(createEmptyScene());
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('ignores touch drawing input', () => {
    const commit = vi.fn();
    const { controller, pointerCapture } = prepareController(commit);
    controller.pointerDown(pointer(2, 'touch'));
    expect(pointerCapture.setPointerCapture).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('places, moves and atomically undoes/redoes a shape without altering strokes', () => {
    const commits: ReturnType<typeof createEmptyScene>[] = [];
    const { controller } = prepareController((scene) => commits.push(scene));
    controller.selectTool('shape', 'rectangle');
    controller.pointerDown(
      pointer(40, 'mouse', { clientX: 100, clientY: 100 }),
    );
    controller.pointerMove(
      pointer(40, 'mouse', { clientX: 220, clientY: 180 }),
    );
    controller.pointerUp(pointer(40, 'mouse', { clientX: 220, clientY: 180 }));
    const placed = controller.getScene().objects[0];
    expect(placed?.kind).toBe('shape');
    controller.undo();
    expect(controller.getScene().objects).toEqual([]);
    controller.redo();
    expect(controller.getScene().objects).toHaveLength(1);
    controller.selectTool('select');
    controller.pointerDown(
      pointer(41, 'mouse', { clientX: 150, clientY: 100 }),
    );
    controller.pointerMove(
      pointer(41, 'mouse', { clientX: 190, clientY: 130 }),
    );
    controller.pointerUp(pointer(41, 'mouse', { clientX: 190, clientY: 130 }));
    const moved = controller.getScene().objects[0];
    expect(moved?.kind === 'shape' ? moved.geometry.x : 0).toBe(140);
    controller.undo();
    const restored = controller.getScene().objects[0];
    expect(restored?.kind === 'shape' ? restored.geometry.x : 0).toBe(100);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  describe.each(WHITEBOARD_PALETTE_SHAPE_KINDS)(
    '%s palette shape',
    (shapeKind) => {
      it('places, resizes, moves, undoes, redoes and round-trips identically', () => {
        const { controller } = prepareController();
        controller.selectTool('shape', shapeKind);
        controller.pointerDown(pointerAt(70, { x: 100, y: 100 }));
        controller.pointerMove(pointerAt(70, { x: 360, y: 300 }));
        controller.pointerUp(pointerAt(70, { x: 360, y: 300 }));
        const placed = controller.getScene().objects[0];
        expect(placed).toMatchObject({ kind: 'shape', shapeKind });
        if (placed?.kind !== 'shape') throw new Error('Forme attendue.');

        const resizeHandle = resizeHandlePosition(placed);
        const resizeTarget = shapeLocalPointToWorld(placed, {
          x: placed.geometry.width + 40,
          y: placed.geometry.height + 30,
        });
        controller.selectTool('select');
        controller.pointerDown(pointerAt(71, resizeHandle));
        controller.pointerMove(pointerAt(71, resizeTarget));
        controller.pointerUp(pointerAt(71, resizeTarget));
        const resized = controller.getScene().objects[0];
        expect(
          resized?.kind === 'shape' ? resized.geometry.width : 0,
        ).toBeGreaterThan(placed.geometry.width);
        controller.undo();
        expect(controller.getScene().objects[0]).toEqual(placed);
        controller.redo();
        expect(controller.getScene().objects[0]).toEqual(resized);
        if (resized?.kind !== 'shape') throw new Error('Forme attendue.');

        const primitive = shapePrimitives(resized)[0]!;
        const localPoint =
          primitive.kind === 'line'
            ? primitive.from
            : primitive.kind === 'ellipse'
              ? {
                  x: primitive.center.x + primitive.radiusX,
                  y: primitive.center.y,
                }
              : primitive.kind === 'polyline'
                ? primitive.points[0]!
                : primitive.position;
        const body = shapeLocalPointToWorld(resized, localPoint);
        const target = { x: body.x + 25, y: body.y + 15 };
        controller.pointerDown(pointerAt(72, body));
        controller.pointerMove(pointerAt(72, target));
        controller.pointerUp(pointerAt(72, target));
        const moved = controller.getScene().objects[0];
        expect(moved?.kind === 'shape' ? moved.geometry.x : 0).toBeCloseTo(
          resized.geometry.x + 25,
        );
        expect(moved?.kind === 'shape' ? moved.geometry.y : 0).toBeCloseTo(
          resized.geometry.y + 15,
        );
        controller.undo();
        expect(controller.getScene().objects[0]).toEqual(resized);
        controller.redo();
        expect(controller.getScene().objects[0]).toEqual(moved);

        const restored = restoreWhiteboardScene(controller.getScene());
        expect(restored.quarantine).toEqual([]);
        expect(restored.scene).toEqual(controller.getScene());
        controller.destroy();
        vi.unstubAllGlobals();
      });
    },
  );

  it('starts rotation from the visible handle outside the selected rectangle', () => {
    const { controller } = prepareController();
    const initial = rectangle();
    controller.replaceScene({ ...createEmptyScene(), objects: [initial] });
    selectRectangle(controller, initial);
    const handle = rotationHandlePosition(initial)!;
    const target = { x: 230, y: 140 };
    controller.pointerDown(pointerAt(51, handle));
    controller.pointerMove(pointerAt(51, target));
    controller.pointerUp(pointerAt(51, target));
    const rotated = controller.getScene().objects[0];
    expect(
      rotated?.kind === 'shape' ? rotated.geometry.rotation : 0,
    ).toBeCloseTo(Math.PI / 2);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('reuses transformed rotation handles and preserves atomic undo/redo', () => {
    const { controller } = prepareController();
    const initial = rectangle(Math.PI / 4);
    controller.replaceScene({ ...createEmptyScene(), objects: [initial] });
    selectRectangle(controller, initial);
    const visibleHandle = rotationHandlePosition(initial)!;
    const targetRotation = -Math.PI / 4;
    const target = rotationHandlePosition(
      rotateShape(initial, targetRotation),
    )!;
    controller.pointerDown(pointerAt(52, visibleHandle));
    controller.pointerMove(pointerAt(52, target));
    controller.pointerUp(pointerAt(52, target));
    const changed = controller.getScene().objects[0];
    expect(
      changed?.kind === 'shape' ? changed.geometry.rotation : 0,
    ).toBeCloseTo(targetRotation);
    controller.undo();
    expect(controller.getScene().objects[0]).toEqual(initial);
    controller.redo();
    expect(controller.getScene().objects[0]).toEqual(changed);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('resizes a rotated rectangle at its visible handle, not its stale handle, with exact history', () => {
    const { controller } = prepareController();
    const initial = rectangle(Math.PI / 4);
    controller.replaceScene({ ...createEmptyScene(), objects: [initial] });
    selectRectangle(controller, initial);
    const visibleHandle = resizeHandlePosition(initial);
    const target = shapeLocalPointToWorld(initial, { x: 160, y: 120 });
    controller.pointerDown(pointerAt(53, visibleHandle));
    controller.pointerMove(pointerAt(53, target));
    controller.pointerUp(pointerAt(53, target));
    const resized = controller.getScene().objects[0];
    expect(resized?.kind).toBe('shape');
    if (resized?.kind !== 'shape') throw new Error('Shape attendue.');
    expect(resized.geometry.width).toBeCloseTo(160);
    expect(resized.geometry.height).toBeCloseTo(120);
    const resizedHandle = resizeHandlePosition(resized);
    expect(resizedHandle.x).toBeCloseTo(target.x, 8);
    expect(resizedHandle.y).toBeCloseTo(target.y, 8);
    controller.undo();
    expect(controller.getScene().objects[0]).toEqual(initial);
    controller.redo();
    expect(controller.getScene().objects[0]).toEqual(resized);

    const staleHandle = {
      x: resized.geometry.x + resized.geometry.width,
      y: resized.geometry.y + resized.geometry.height,
    };
    expect(worldPointToShapeLocal(resized, staleHandle)).not.toEqual({
      x: resized.geometry.width,
      y: resized.geometry.height,
    });
    controller.pointerDown(pointerAt(54, staleHandle));
    controller.pointerMove(
      pointerAt(54, { x: staleHandle.x + 30, y: staleHandle.y + 20 }),
    );
    controller.pointerUp(
      pointerAt(54, { x: staleHandle.x + 30, y: staleHandle.y + 20 }),
    );
    const afterStaleHandle = controller.getScene().objects[0];
    expect(
      afterStaleHandle?.kind === 'shape'
        ? {
            width: afterStaleHandle.geometry.width,
            height: afterStaleHandle.geometry.height,
          }
        : null,
    ).toEqual({
      width: resized.geometry.width,
      height: resized.geometry.height,
    });
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('preserves redo after selecting a shape without moving it', () => {
    const { controller } = prepareController();
    const initial = rectangle();
    controller.replaceScene({ ...createEmptyScene(), objects: [initial] });
    selectRectangle(controller, initial);
    moveSelectedRectangle(controller, initial, 60);
    const modified = controller.getScene().objects[0];
    controller.undo();
    selectRectangle(controller, initial);
    controller.redo();
    expect(controller.getScene().objects[0]).toEqual(modified);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('preserves redo after an empty selection click', () => {
    const { controller } = prepareController();
    const initial = rectangle();
    controller.replaceScene({ ...createEmptyScene(), objects: [initial] });
    selectRectangle(controller, initial);
    moveSelectedRectangle(controller, initial, 61);
    const modified = controller.getScene().objects[0];
    controller.undo();
    controller.pointerDown(pointerAt(62, { x: 700, y: 600 }));
    controller.pointerUp(pointerAt(62, { x: 700, y: 600 }));
    controller.redo();
    expect(controller.getScene().objects[0]).toEqual(modified);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('preserves redo when Escape cancels an in-progress placement', () => {
    const { controller } = prepareController();
    const initial = rectangle();
    controller.replaceScene({ ...createEmptyScene(), objects: [initial] });
    selectRectangle(controller, initial);
    moveSelectedRectangle(controller, initial, 63);
    const modified = controller.getScene().objects[0];
    controller.undo();
    controller.selectTool('shape', 'circle');
    controller.pointerDown(pointerAt(64, { x: 300, y: 300 }));
    controller.pointerMove(pointerAt(64, { x: 380, y: 370 }));
    controller.cancelInteraction();
    expect(controller.getScene().objects).toEqual([initial]);
    controller.redo();
    expect(controller.getScene().objects[0]).toEqual(modified);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('does not add an undo no-op for selection and pointerUp without movement', () => {
    const { controller } = prepareController();
    const initial = rectangle();
    controller.replaceScene({ ...createEmptyScene(), objects: [initial] });
    selectRectangle(controller, initial);
    moveSelectedRectangle(controller, initial, 65);
    const modified = controller.getScene().objects[0];
    if (modified?.kind !== 'shape') throw new Error('Shape attendue.');
    selectRectangle(controller, modified);
    controller.undo();
    expect(controller.getScene().objects[0]).toEqual(initial);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('isolates an active Pencil stroke from touch and other pointers', () => {
    const commits: ReturnType<typeof createEmptyScene>[] = [];
    const { controller, pointerCapture } = prepareController((scene) =>
      commits.push(scene),
    );
    controller.pointerDown(pointer(10, 'pen'));
    controller.pointerDown(pointer(11, 'mouse'));
    controller.pointerMove(pointer(20, 'touch', { clientX: 300 }));
    controller.pointerMove(pointer(11, 'mouse', { clientX: 400 }));
    controller.pointerUp(pointer(20, 'touch'));
    controller.pointerUp(pointer(11, 'mouse'));
    expect(commits).toEqual([]);
    expect(pointerCapture.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(pointerCapture.setPointerCapture).toHaveBeenCalledWith(10);
    expect(pointerCapture.releasePointerCapture).not.toHaveBeenCalled();

    controller.pointerMove(pointer(10, 'pen', { clientX: 40 }));
    controller.pointerUp(pointer(10, 'pen', { clientX: 50 }));
    expect(commits).toHaveLength(1);
    const isolated = commits[0]?.objects[0];
    expect(isolated?.kind === 'stroke' ? isolated.points : []).toHaveLength(3);
    expect(pointerCapture.releasePointerCapture).toHaveBeenCalledWith(10);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('falls back to the current move when coalesced events are empty', () => {
    const commits: ReturnType<typeof createEmptyScene>[] = [];
    const { controller } = prepareController((scene) => commits.push(scene));
    controller.pointerDown(pointer(5, 'pen'));
    controller.pointerMove(
      pointer(5, 'pen', {
        clientX: 40,
        getCoalescedEvents: () => [],
      }),
    );
    controller.pointerUp(pointer(5, 'pen', { clientX: 60 }));
    const coalesced = commits[0]?.objects[0];
    expect(
      coalesced?.kind === 'stroke' ? coalesced.points.map(({ x }) => x) : [],
    ).toEqual([20, 40, 60]);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('handles cancellation and allows a new mouse gesture', () => {
    const commits: ReturnType<typeof createEmptyScene>[] = [];
    const { controller, pointerCapture } = prepareController((scene) =>
      commits.push(scene),
    );
    controller.pointerDown(pointer(8, 'pen'));
    controller.pointerCancel(pointer(99, 'touch'));
    expect(commits).toEqual([]);
    controller.pointerCancel(pointer(8, 'pen'));
    expect(commits).toHaveLength(0);
    expect(controller.getScene().objects).toEqual([]);
    expect(pointerCapture.releasePointerCapture).toHaveBeenCalledWith(8);

    controller.pointerDown(pointer(9, 'mouse'));
    controller.pointerUp(pointer(9, 'mouse'));
    expect(commits).toHaveLength(1);
    expect(commits[0]?.objects).toHaveLength(1);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('handles lost capture without releasing it again', () => {
    const commits: ReturnType<typeof createEmptyScene>[] = [];
    const { controller, pointerCapture } = prepareController((scene) =>
      commits.push(scene),
    );
    controller.pointerDown(pointer(12, 'pen'));
    pointerCapture.capturedPointers.delete(12);
    controller.lostPointerCapture(pointer(13, 'pen'));
    expect(commits).toEqual([]);
    controller.lostPointerCapture(pointer(12, 'pen'));
    expect(commits).toHaveLength(0);
    expect(controller.getScene().objects).toEqual([]);
    expect(pointerCapture.releasePointerCapture).not.toHaveBeenCalled();
    controller.pointerDown(pointer(14, 'mouse'));
    expect(pointerCapture.setPointerCapture).toHaveBeenLastCalledWith(14);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('does not throw when capture is lost just before release', () => {
    const { controller, pointerCapture } = prepareController();
    controller.pointerDown(pointer(30, 'pen'));
    pointerCapture.hasPointerCapture.mockReturnValueOnce(true);
    pointerCapture.releasePointerCapture.mockImplementationOnce(() => {
      throw new DOMException('Capture was lost.');
    });
    expect(() => controller.pointerUp(pointer(30, 'pen'))).not.toThrow();
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('snaps an eligible held Pencil stroke to a straight line after 500 ms', () => {
    vi.useFakeTimers();
    const { controller } = prepareController();
    controller.pointerDown(
      pointer(70, 'pen', { clientX: 100, clientY: 200, timeStamp: 0 }),
    );
    for (let index = 1; index <= 10; index += 1)
      controller.pointerMove(
        pointer(70, 'pen', {
          clientX: 100 + index * 10,
          clientY: 200 + (index % 2),
          timeStamp: index * 10,
        }),
      );
    vi.advanceTimersByTime(500);
    const snapped = controller.getScene().objects[0];
    expect(snapped?.kind === 'stroke' ? snapped.points : []).toHaveLength(2);
    controller.pointerUp(
      pointer(70, 'pen', { clientX: 210, clientY: 201, timeStamp: 600 }),
    );
    controller.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('snaps a held circular Pencil stroke and keeps ordinary writing unsnapped when disabled', () => {
    vi.useFakeTimers();
    const { controller } = prepareController();
    const circle = Array.from({ length: 25 }, (_, index) => {
      const angle = (index / 24) * Math.PI * 2;
      return {
        x: 300 + Math.cos(angle) * 60,
        y: 300 + Math.sin(angle) * 60,
      };
    });
    controller.pointerDown(
      pointer(71, 'pen', {
        clientX: circle[0]!.x,
        clientY: circle[0]!.y,
        timeStamp: 0,
      }),
    );
    circle.slice(1).forEach((sample, index) =>
      controller.pointerMove(
        pointer(71, 'pen', {
          clientX: sample.x,
          clientY: sample.y,
          timeStamp: index * 10 + 10,
        }),
      ),
    );
    vi.advanceTimersByTime(500);
    const snapped = controller.getScene().objects[0];
    expect(snapped?.kind === 'stroke' ? snapped.points : []).toHaveLength(49);
    controller.pointerUp(
      pointer(71, 'pen', {
        clientX: circle.at(-1)!.x,
        clientY: circle.at(-1)!.y,
        timeStamp: 800,
      }),
    );

    controller.setMagicShapes(false);
    controller.pointerDown(
      pointer(72, 'pen', { clientX: 100, clientY: 400, timeStamp: 900 }),
    );
    controller.pointerMove(
      pointer(72, 'pen', { clientX: 220, clientY: 400, timeStamp: 950 }),
    );
    controller.pointerMove(
      pointer(72, 'pen', { clientX: 260, clientY: 400, timeStamp: 980 }),
    );
    vi.advanceTimersByTime(600);
    const ordinary = controller.getScene().objects.at(-1);
    expect(
      ordinary?.kind === 'stroke' ? ordinary.points.length : 0,
    ).toBeGreaterThan(2);
    controller.pointerCancel(
      pointer(72, 'pen', { clientX: 220, clientY: 400, timeStamp: 1_600 }),
    );
    controller.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('snaps a held rectangle at 500 ms, not at 499 ms, as one undo action', () => {
    vi.useFakeTimers();
    const { controller } = prepareController();
    const corners = [
      { x: 120, y: 140 },
      { x: 280, y: 145 },
      { x: 275, y: 250 },
      { x: 118, y: 248 },
      { x: 120, y: 140 },
    ];
    const samples = corners.flatMap((start, side) => {
      const end = corners[side + 1];
      if (!end) return [];
      return Array.from({ length: 7 }, (_, index) => ({
        x: start.x + ((end.x - start.x) * index) / 7,
        y: start.y + ((end.y - start.y) * index) / 7 + (index % 2 ? 1 : -1),
      }));
    });
    controller.pointerDown(
      pointer(80, 'pen', { clientX: samples[0]!.x, clientY: samples[0]!.y }),
    );
    samples.slice(1).forEach((sample, index) =>
      controller.pointerMove(
        pointer(80, 'pen', {
          clientX: sample.x,
          clientY: sample.y,
          timeStamp: index + 2,
        }),
      ),
    );
    vi.advanceTimersByTime(499);
    const rough = controller.getScene().objects[0];
    expect(rough?.kind === 'stroke' ? rough.points.length : 0).toBeGreaterThan(
      5,
    );
    vi.advanceTimersByTime(1);
    const snapped = controller.getScene().objects[0];
    expect(snapped?.kind === 'stroke' ? snapped.points : []).toHaveLength(5);
    controller.pointerUp(
      pointer(80, 'pen', {
        clientX: samples.at(-1)!.x,
        clientY: samples.at(-1)!.y,
      }),
    );
    const committed = controller.getScene().objects[0];
    expect(committed?.kind === 'stroke' ? committed.points : []).toHaveLength(
      5,
    );
    controller.undo();
    expect(controller.getScene().objects).toEqual([]);
    controller.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('applies scribble delete atomically, supports undo/redo, and keeps empty scribbles', () => {
    const { controller } = prepareController();
    const target = createStroke(input(0, 70).point, 4, 'target');
    target.points = [input(0, 70).point, input(170, 70).point];
    const secondTarget = createStroke(input(0, 90).point, 4, 'second-target');
    secondTarget.points = [input(0, 90).point, input(170, 90).point];
    controller.replaceScene({
      ...createEmptyScene(),
      objects: [target, secondTarget],
    });
    controller.setMagicShapes(false);
    const gesture = Array.from({ length: 28 }, (_, index) => ({
      x: index % 2 === 0 ? 20 : 140,
      y: 35 + ((index * 17) % 70),
    }));
    controller.pointerDown(
      pointer(81, 'pen', { clientX: gesture[0]!.x, clientY: gesture[0]!.y }),
    );
    gesture.slice(1).forEach((sample, index) =>
      controller.pointerMove(
        pointer(81, 'pen', {
          clientX: sample.x,
          clientY: sample.y,
          timeStamp: index + 2,
        }),
      ),
    );
    controller.pointerUp(
      pointer(81, 'pen', {
        clientX: gesture.at(-1)!.x,
        clientY: gesture.at(-1)!.y,
      }),
    );
    expect(controller.getScene().objects).toEqual([]);
    controller.undo();
    expect(controller.getScene().objects).toEqual([target, secondTarget]);
    controller.redo();
    expect(controller.getScene().objects).toEqual([]);

    const emptyGesture = gesture.map((sample) => ({
      ...sample,
      y: sample.y + 300,
    }));
    controller.pointerDown(
      pointer(82, 'pen', {
        clientX: emptyGesture[0]!.x,
        clientY: emptyGesture[0]!.y,
      }),
    );
    emptyGesture.slice(1).forEach((sample, index) =>
      controller.pointerMove(
        pointer(82, 'pen', {
          clientX: sample.x,
          clientY: sample.y,
          timeStamp: index + 40,
        }),
      ),
    );
    controller.pointerUp(
      pointer(82, 'pen', {
        clientX: emptyGesture.at(-1)!.x,
        clientY: emptyGesture.at(-1)!.y,
      }),
    );
    expect(controller.getScene().objects).toHaveLength(1);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('keeps scribble ink when the feature is disabled', () => {
    const { controller } = prepareController();
    const target = createStroke(input(0, 70).point, 4, 'target');
    target.points = [input(0, 70).point, input(170, 70).point];
    controller.replaceScene({ ...createEmptyScene(), objects: [target] });
    controller.setScribbleErase(false);
    controller.setMagicShapes(false);
    const gesture = Array.from({ length: 28 }, (_, index) => ({
      x: index % 2 ? 140 : 20,
      y: 35 + ((index * 17) % 70),
    }));
    controller.pointerDown(
      pointer(83, 'pen', { clientX: gesture[0]!.x, clientY: gesture[0]!.y }),
    );
    gesture
      .slice(1)
      .forEach((sample) =>
        controller.pointerMove(
          pointer(83, 'pen', { clientX: sample.x, clientY: sample.y }),
        ),
      );
    controller.pointerUp(
      pointer(83, 'pen', {
        clientX: gesture.at(-1)!.x,
        clientY: gesture.at(-1)!.y,
      }),
    );
    expect(controller.getScene().objects).toHaveLength(2);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('uses object and pixel eraser modes with atomic undo/redo', () => {
    const { controller } = prepareController();
    const target = createStroke(input(0, 100).point, 4, 'long');
    target.points = [input(0, 100).point, input(400, 100).point];
    controller.replaceScene({ ...createEmptyScene(), objects: [target] });
    controller.selectTool('eraser');
    controller.pointerDown(pointer(84, 'pen', { clientX: 200, clientY: 100 }));
    controller.pointerUp(pointer(84, 'pen', { clientX: 200, clientY: 100 }));
    expect(controller.getScene().objects).toEqual([]);
    controller.undo();
    expect(controller.getScene().objects).toEqual([target]);

    controller.setEraserMode('pixel');
    controller.pointerDown(pointer(85, 'pen', { clientX: 100, clientY: 100 }));
    controller.pointerMove(pointer(85, 'pen', { clientX: 300, clientY: 100 }));
    controller.pointerUp(pointer(85, 'pen', { clientX: 300, clientY: 100 }));
    const fragments = controller
      .getScene()
      .objects.filter((object) => object.kind === 'stroke');
    expect(fragments).toHaveLength(2);
    expect(fragments[0]!.points.at(-1)!.x).toBeLessThan(90);
    expect(fragments[1]!.points[0]!.x).toBeGreaterThan(310);
    controller.undo();
    expect(controller.getScene().objects).toEqual([target]);
    controller.redo();
    expect(
      controller
        .getScene()
        .objects.filter((object) => object.kind === 'stroke'),
    ).toHaveLength(2);
    controller.destroy();
    vi.unstubAllGlobals();
  });

  it('persists an ordered non-selectable pixel mask for vector shapes only', () => {
    const { controller } = prepareController();
    const shape = rectangle();
    controller.replaceScene({ ...createEmptyScene(), objects: [shape] });
    controller.setEraserMode('pixel');
    controller.selectTool('eraser');
    controller.pointerDown(pointer(86, 'pen', { clientX: 100, clientY: 140 }));
    controller.pointerMove(pointer(86, 'pen', { clientX: 220, clientY: 140 }));
    controller.pointerUp(pointer(86, 'pen', { clientX: 220, clientY: 140 }));
    expect(controller.getScene().objects[0]).toEqual(shape);
    expect(controller.getScene().objects[1]).toMatchObject({
      kind: 'eraser-mask',
      radius: 12,
    });
    expect(restoreWhiteboardScene(controller.getScene())).toEqual({
      scene: controller.getScene(),
      quarantine: [],
    });
    controller.selectTool('pen');
    controller.pointerDown(pointer(87, 'pen', { clientX: 150, clientY: 140 }));
    controller.pointerUp(pointer(87, 'pen', { clientX: 170, clientY: 140 }));
    expect(controller.getScene().objects.map((object) => object.kind)).toEqual([
      'shape',
      'eraser-mask',
      'stroke',
    ]);
    controller.destroy();
    vi.unstubAllGlobals();
  });
});

describe('scene restoration', () => {
  it('is idempotent and quarantines only invalid objects', () => {
    const valid = createStroke(input(1, 2).point, 3, 'valid');
    const source = {
      ...createEmptyScene(),
      schemaVersion: 0,
      objects: [valid, { kind: 'stroke', id: 'broken' }],
    };
    const first = restoreWhiteboardScene(source);
    const second = restoreWhiteboardScene(first.scene);
    expect(first.scene.schemaVersion).toBe(4);
    expect(first.scene.objects).toEqual([valid]);
    expect(first.quarantine).toHaveLength(1);
    expect(second.scene).toEqual(first.scene);
    expect(second.quarantine).toEqual([]);
  });
});
