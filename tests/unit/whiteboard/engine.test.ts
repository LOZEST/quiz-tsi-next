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
    expect(commits).toHaveLength(1);
    expect(pointerCapture.releasePointerCapture).toHaveBeenCalledWith(8);

    controller.pointerDown(pointer(9, 'mouse'));
    controller.pointerUp(pointer(9, 'mouse'));
    expect(commits).toHaveLength(2);
    expect(commits[1]?.objects).toHaveLength(2);
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
    expect(commits).toHaveLength(1);
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
    expect(first.scene.schemaVersion).toBe(2);
    expect(first.scene.objects).toEqual([valid]);
    expect(first.quarantine).toHaveLength(1);
    expect(second.scene).toEqual(first.scene);
    expect(second.quarantine).toEqual([]);
  });
});
