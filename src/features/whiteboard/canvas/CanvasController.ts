import type { WhiteboardScene } from '@domain/whiteboard/WhiteboardScene';
import { pointFromPointerEvent, type PointerInput } from '../model/Point';
import { snapshotScene } from '../model/WhiteboardSnapshot';
import { CanvasCoordinates } from './CanvasCoordinates';
import { CanvasRenderer } from './CanvasRenderer';
import { EraserTool } from '../tools/EraserTool';
import { PenTool } from '../tools/PenTool';
import { ToolManager } from '../tools/ToolManager';
import type { WhiteboardActiveTool } from '@app/providers/WhiteboardProvider';
import {
  createShape,
  hitTestResizeHandle,
  hitTestRotationHandle,
  hitTestShape,
  resizeShapeFromWorldPoint,
  rotateShape,
  translateShape,
  type Point2d,
  type WhiteboardShape,
  type WhiteboardShapeKind,
} from '@domain/whiteboard/WhiteboardShape';

export class CanvasController {
  private scene: WhiteboardScene;
  private renderer: CanvasRenderer;
  private coordinates = new CanvasCoordinates();
  private pen = new PenTool();
  private tools = new ToolManager({
    pen: this.pen,
    eraser: new EraserTool(),
  });
  private undoStack: WhiteboardScene[] = [];
  private redoStack: WhiteboardScene[] = [];
  private activeTool: WhiteboardActiveTool = 'pen';
  private shapeKind: WhiteboardShapeKind = 'line';
  private selectedShapeId: string | null = null;
  private gestureStart: Point2d | null = null;
  private gestureShape: WhiteboardShape | null = null;
  private gestureKind: 'place' | 'move' | 'resize' | 'rotate' | null = null;
  private currentPenWidth = 3;
  private transactionBaseline: WhiteboardScene | null = null;

  getScene(): WhiteboardScene {
    return this.scene;
  }
  private activePointerId: number | null = null;
  private activePointerType: string | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    initialScene: WhiteboardScene,
    private readonly onCommit: (scene: WhiteboardScene) => void,
  ) {
    this.scene = initialScene;
    this.renderer = new CanvasRenderer(canvas);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    this.resize();
  }

  private input(event: PointerEvent): PointerInput {
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(
      this.canvas.clientWidth / this.scene.logicalWidth,
      this.canvas.clientHeight / this.scene.logicalHeight,
    );
    const offsetX =
      (this.canvas.clientWidth - this.scene.logicalWidth * scale) / 2;
    const offsetY =
      (this.canvas.clientHeight - this.scene.logicalHeight * scale) / 2;
    return {
      pointerId: event.pointerId,
      pointerType:
        event.pointerType === 'pen' || event.pointerType === 'touch'
          ? event.pointerType
          : 'mouse',
      point: pointFromPointerEvent(
        event,
        (event.clientX - rect.left - offsetX) / scale,
        (event.clientY - rect.top - offsetY) / scale,
      ),
    };
  }

  pointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch' || this.activePointerId !== null) return;
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    this.activePointerId = event.pointerId;
    this.activePointerType = event.pointerType;
    this.transactionBaseline = snapshotScene(this.scene).scene;
    if (this.activeTool === 'shape' || this.activeTool === 'select') {
      const point = this.input(event).point;
      this.gestureStart = point;
      if (this.activeTool === 'shape') {
        this.gestureKind = 'place';
        this.gestureShape = createShape(
          `shape-${event.timeStamp}-${event.pointerId}`,
          this.shapeKind,
          point,
          { x: point.x + 1, y: point.y + 1 },
          {
            color: '#1d1d1f',
            width: this.penWidth(),
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          },
        );
        this.scene = {
          ...this.scene,
          objects: [...this.scene.objects, this.gestureShape],
        };
      } else {
        const currentSelection = this.scene.objects.find(
          (object): object is WhiteboardShape =>
            object.kind === 'shape' && object.id === this.selectedShapeId,
        );
        let selected: WhiteboardShape | undefined;
        if (
          currentSelection &&
          hitTestRotationHandle(currentSelection, point)
        ) {
          selected = currentSelection;
          this.gestureKind = 'rotate';
        } else if (
          currentSelection &&
          hitTestResizeHandle(currentSelection, point)
        ) {
          selected = currentSelection;
          this.gestureKind = 'resize';
        } else if (currentSelection && hitTestShape(currentSelection, point)) {
          selected = currentSelection;
          this.gestureKind = 'move';
        } else {
          selected = [...this.scene.objects]
            .reverse()
            .find(
              (object): object is WhiteboardShape =>
                object.kind === 'shape' && hitTestShape(object, point),
            );
          this.gestureKind = selected ? 'move' : null;
        }
        this.selectedShapeId = selected?.id ?? null;
        this.gestureShape = selected ?? null;
      }
      this.renderer.setSelection(this.selectedShapeId);
      this.renderer.schedule(this.scene);
      return;
    }
    this.scene = this.tools.current.begin(this.scene, this.input(event)).scene;
    this.renderer.schedule(this.scene);
  }

  pointerMove(event: PointerEvent) {
    if (!this.isActivePointer(event)) return;
    if (this.gestureKind && this.gestureStart && this.gestureShape) {
      const point = this.input(event).point;
      let shape = this.gestureShape;
      if (this.gestureKind === 'place')
        shape = createShape(
          shape.id,
          shape.shapeKind,
          this.gestureStart,
          point,
          shape.style,
        );
      if (this.gestureKind === 'move')
        shape = translateShape(
          shape,
          point.x - this.gestureStart.x,
          point.y - this.gestureStart.y,
        );
      if (this.gestureKind === 'resize')
        shape = resizeShapeFromWorldPoint(shape, point);
      if (this.gestureKind === 'rotate') {
        const center = {
          x: shape.geometry.x + shape.geometry.width / 2,
          y: shape.geometry.y + shape.geometry.height / 2,
        };
        shape = rotateShape(
          shape,
          Math.atan2(point.y - center.y, point.x - center.x) + Math.PI / 2,
        );
      }
      this.scene = {
        ...this.scene,
        objects: this.scene.objects.map((object) =>
          object.id === shape.id ? shape : object,
        ),
      };
      this.renderer.schedule(this.scene);
      return;
    }
    if (this.activeTool === 'shape' || this.activeTool === 'select') {
      this.renderer.schedule(this.scene);
      return;
    }
    const coalesced = event.getCoalescedEvents?.();
    const samples = coalesced && coalesced.length > 0 ? coalesced : [event];
    for (const sample of samples) {
      if (!this.isActivePointer(sample)) continue;
      this.scene = this.tools.current.move(
        this.scene,
        this.input(sample),
      ).scene;
    }
    this.renderer.schedule(this.scene);
  }

  pointerUp(event: PointerEvent) {
    if (!this.isActivePointer(event)) return;
    if (this.activeTool === 'shape' || this.activeTool === 'select') {
      this.pointerMove(event);
      if (this.gestureKind === 'place')
        this.selectedShapeId = this.gestureShape?.id ?? null;
      this.renderer.setSelection(this.selectedShapeId);
      this.clearGesture();
      this.finishPointer(event.pointerId, true);
      this.finishTransaction();
      return;
    }
    this.scene = this.tools.current.end(this.scene, this.input(event)).scene;
    this.finishPointer(event.pointerId, true);
    this.finishTransaction();
  }

  pointerCancel(event: PointerEvent) {
    if (!this.isActivePointer(event)) return;
    this.finishPointer(event.pointerId, true);
    this.finishTransaction();
  }

  lostPointerCapture(event: PointerEvent) {
    if (!this.isActivePointer(event)) return;
    this.finishPointer(event.pointerId, false);
    this.finishTransaction();
  }

  private isActivePointer(event: PointerEvent): boolean {
    return (
      event.pointerId === this.activePointerId &&
      event.pointerType === this.activePointerType
    );
  }

  private finishPointer(pointerId: number, releaseCapture: boolean) {
    this.activePointerId = null;
    this.activePointerType = null;
    if (!releaseCapture || !this.canvas.hasPointerCapture(pointerId)) return;
    try {
      this.canvas.releasePointerCapture(pointerId);
    } catch {
      // The browser may lose capture between the ownership check and release.
    }
  }

  selectTool(
    tool: WhiteboardActiveTool,
    shapeKind: WhiteboardShapeKind = this.shapeKind,
  ) {
    this.activeTool = tool;
    this.shapeKind = shapeKind;
    if (tool === 'pen' || tool === 'eraser') this.tools.select(tool);
    if (tool !== 'select') this.selectedShapeId = null;
    this.renderer.setSelection(this.selectedShapeId);
    this.renderer.schedule(this.scene);
  }
  setPenWidth(width: number) {
    this.currentPenWidth = width;
    this.pen.setWidth(width);
  }
  setGrid(enabled: boolean) {
    this.renderer.setGrid(enabled);
    this.renderer.schedule(this.scene);
  }
  replaceScene(scene: WhiteboardScene) {
    this.scene = scene;
    this.undoStack = [];
    this.redoStack = [];
    this.renderer.schedule(scene);
  }
  undo() {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(this.scene);
    this.scene = previous;
    this.commit();
  }
  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.scene);
    this.scene = next;
    this.commit();
  }
  private commit() {
    this.scene = { ...this.scene, updatedAt: new Date().toISOString() };
    this.renderer.schedule(this.scene);
    this.onCommit(this.scene);
  }
  private resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.coordinates.resize(width, height, ratio);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.renderer.schedule(this.scene);
  }
  destroy() {
    this.activePointerId = null;
    this.activePointerType = null;
    this.resizeObserver?.disconnect();
    this.renderer.destroy();
  }

  cancelInteraction() {
    if (this.transactionBaseline) {
      this.scene = this.transactionBaseline;
      this.transactionBaseline = null;
      const pointerId = this.activePointerId;
      this.activePointerId = null;
      this.activePointerType = null;
      if (pointerId !== null && this.canvas.hasPointerCapture(pointerId)) {
        try {
          this.canvas.releasePointerCapture(pointerId);
        } catch {
          // Capture may already have been released by the browser.
        }
      }
      this.clearGesture();
      this.renderer.schedule(this.scene);
    }
  }

  private finishTransaction() {
    const baseline = this.transactionBaseline;
    this.transactionBaseline = null;
    if (!baseline) return;
    if (
      JSON.stringify(baseline.objects) === JSON.stringify(this.scene.objects)
    ) {
      this.scene = baseline;
      this.renderer.schedule(this.scene);
      return;
    }
    this.undoStack.push(baseline);
    this.redoStack = [];
    this.commit();
  }

  private penWidth() {
    return this.currentPenWidth;
  }

  private clearGesture() {
    this.gestureStart = null;
    this.gestureShape = null;
    this.gestureKind = null;
  }
}
