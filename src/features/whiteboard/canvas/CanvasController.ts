import type {
  WhiteboardScene,
  WhiteboardStroke,
} from '@domain/whiteboard/WhiteboardScene';
import { pointFromPointerEvent, type PointerInput } from '../model/Point';
import { snapshotScene } from '../model/WhiteboardSnapshot';
import { CanvasCoordinates } from './CanvasCoordinates';
import { CanvasRenderer } from './CanvasRenderer';
import { EraserTool } from '../tools/EraserTool';
import { PixelEraserTool } from '../tools/PixelEraserTool';
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
import {
  circleCandidate,
  rectangleCandidate,
  straightCandidate,
  toCircleStroke,
  toRectangleStroke,
  toStraightStroke,
} from '@domain/whiteboard/MagicShapes';
import {
  scribbleCandidate,
  scribbleTargetIds,
} from '@domain/whiteboard/ScribbleErase';

export class CanvasController {
  private scene: WhiteboardScene;
  private renderer: CanvasRenderer;
  private coordinates = new CanvasCoordinates();
  private pen = new PenTool();
  private objectEraser = new EraserTool();
  private pixelEraser = new PixelEraserTool();
  private tools = new ToolManager({
    pen: this.pen,
    eraser: this.objectEraser,
  });
  private undoStack: WhiteboardScene[] = [];
  private redoStack: WhiteboardScene[] = [];
  private activeTool: WhiteboardActiveTool = 'pen';
  private shapeKind: WhiteboardShapeKind = 'grid-coordinate-system';
  private selectedShapeId: string | null = null;
  private gestureStart: Point2d | null = null;
  private gestureShape: WhiteboardShape | null = null;
  private gestureKind: 'place' | 'move' | 'resize' | 'rotate' | null = null;
  private currentPenWidth = 3;
  private transactionBaseline: WhiteboardScene | null = null;
  private magicShapesEnabled = true;
  private scribbleEraseEnabled = true;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private holdLastPoint: Point2d | null = null;
  private snappedStroke: 'line' | 'circle' | 'rectangle' | null = null;
  private activePenStrokeId: string | null = null;

  getScene(): WhiteboardScene {
    return this.scene;
  }
  getActiveTool(): WhiteboardActiveTool {
    return this.activeTool;
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
    event.stopPropagation?.();
    this.canvas.setPointerCapture(event.pointerId);
    this.activePointerId = event.pointerId;
    this.activePointerType = event.pointerType;
    this.transactionBaseline = snapshotScene(this.scene).scene;
    this.snappedStroke = null;
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
    if (this.activeTool === 'pen') {
      const stroke = this.scene.objects.at(-1);
      this.activePenStrokeId = stroke?.kind === 'stroke' ? stroke.id : null;
    }
    this.renderer.schedule(this.scene);
    this.armMagicShapeHold(this.input(event).point);
  }

  pointerMove(event: PointerEvent) {
    if (!this.isActivePointer(event)) return;
    event.preventDefault();
    event.stopPropagation?.();
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
    let latestPoint = this.input(event).point;
    for (const sample of samples) {
      if (!this.isActivePointer(sample)) continue;
      const input = this.input(sample);
      latestPoint = input.point;
      this.scene = this.tools.current.move(this.scene, input).scene;
    }
    if (this.snappedStroke === 'line') this.snapActiveStroke('line');
    if (this.snappedStroke === 'rectangle') this.snapActiveStroke('rectangle');
    if (this.snappedStroke !== 'circle') this.armMagicShapeHold(latestPoint);
    this.renderer.schedule(this.scene);
  }

  pointerUp(event: PointerEvent) {
    if (!this.isActivePointer(event)) return;
    event.preventDefault();
    this.clearHoldTimer();
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
    if (this.activeTool === 'pen' && this.snappedStroke) this.pen.cancel();
    else
      this.scene = this.tools.current.end(this.scene, this.input(event)).scene;
    if (this.activeTool === 'pen') this.applyScribbleErase();
    this.activePenStrokeId = null;
    this.finishPointer(event.pointerId, true);
    this.finishTransaction();
  }

  pointerCancel(event: PointerEvent) {
    if (!this.isActivePointer(event)) return;
    event.preventDefault();
    this.clearHoldTimer();
    this.abortTransaction();
    this.finishPointer(event.pointerId, true);
  }

  lostPointerCapture(event: PointerEvent) {
    if (!this.isActivePointer(event)) return;
    this.clearHoldTimer();
    this.abortTransaction();
    this.finishPointer(event.pointerId, false);
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
  setMagicShapes(enabled: boolean) {
    this.magicShapesEnabled = enabled;
    if (!enabled) this.clearHoldTimer();
  }
  setScribbleErase(enabled: boolean) {
    this.scribbleEraseEnabled = enabled;
  }
  setEraserMode(mode: 'object' | 'pixel') {
    this.pixelEraser.cancel();
    this.tools.replaceEraser(
      mode === 'pixel' ? this.pixelEraser : this.objectEraser,
    );
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
    this.clearHoldTimer();
    this.pen.cancel();
    this.pixelEraser.cancel();
    this.activePointerId = null;
    this.activePointerType = null;
    this.resizeObserver?.disconnect();
    this.renderer.destroy();
  }

  cancelInteraction() {
    this.clearHoldTimer();
    if (this.transactionBaseline) {
      const pointerId = this.activePointerId;
      this.abortTransaction();
      this.activePointerId = null;
      this.activePointerType = null;
      if (pointerId !== null && this.canvas.hasPointerCapture(pointerId)) {
        try {
          this.canvas.releasePointerCapture(pointerId);
        } catch {
          // Capture may already have been released by the browser.
        }
      }
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

  // A hand-held pen (unlike a mouse) never sits perfectly still — natural
  // hand tremor keeps producing pointermove events even while the user is
  // trying to hold the stroke's end still for the shape-snap gesture.
  // Judging "still enough" by *cumulative* drift from a single frozen origin
  // doesn't work on real hardware: a hand can't hold a fixed point, it
  // wanders, and over hundreds of samples that wander eventually exceeds any
  // fixed radius, so the timer kept resetting forever and the gesture could
  // never complete. Comparing each point only to the *previous* one instead
  // lets slow wandering accumulate freely (each individual step still reads
  // as jitter) while genuine drawing motion -- which moves far more per
  // sample -- still resets it immediately.
  private static readonly HOLD_STEP_TOLERANCE = 4;

  private armMagicShapeHold(point: Point2d) {
    const previous = this.holdLastPoint;
    this.holdLastPoint = point;
    const isJitterStep =
      previous !== null &&
      Math.hypot(point.x - previous.x, point.y - previous.y) <=
        CanvasController.HOLD_STEP_TOLERANCE;
    if (isJitterStep && this.holdTimer !== null) return;
    this.clearHoldTimer();
    if (!this.magicShapesEnabled || this.activeTool !== 'pen') return;
    this.holdTimer = setTimeout(() => this.checkMagicShapeHold(), 500);
  }

  private checkMagicShapeHold() {
    if (this.activePointerId === null) return;
    const stroke = [...this.scene.objects]
      .reverse()
      .find((object) => object.kind === 'stroke');
    const points = stroke?.kind === 'stroke' ? stroke.points : null;
    if (!points) return;
    if (rectangleCandidate(points)) this.snapActiveStroke('rectangle');
    else if (circleCandidate(points)) this.snapActiveStroke('circle');
    else if (straightCandidate(points)) this.snapActiveStroke('line');
  }

  private snapActiveStroke(kind: 'line' | 'circle' | 'rectangle') {
    let index = -1;
    for (
      let candidate = this.scene.objects.length - 1;
      candidate >= 0;
      candidate -= 1
    ) {
      if (this.scene.objects[candidate]?.kind === 'stroke') {
        index = candidate;
        break;
      }
    }
    const stroke = this.scene.objects[index];
    if (!stroke || stroke.kind !== 'stroke') return;
    const snapped =
      kind === 'circle'
        ? toCircleStroke(stroke)
        : kind === 'rectangle'
          ? toRectangleStroke(stroke)
          : toStraightStroke(stroke);
    this.scene = {
      ...this.scene,
      objects: this.scene.objects.map((object, objectIndex) =>
        objectIndex === index ? snapped : object,
      ),
    };
    this.snappedStroke = kind;
    this.renderer.schedule(this.scene);
  }

  private clearHoldTimer() {
    if (this.holdTimer !== null) clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }

  private applyScribbleErase() {
    if (
      !this.scribbleEraseEnabled ||
      this.snappedStroke ||
      !this.activePenStrokeId
    )
      return;
    const scribble = this.scene.objects.find(
      (object): object is WhiteboardStroke =>
        object.kind === 'stroke' && object.id === this.activePenStrokeId,
    );
    if (!scribble || !scribbleCandidate(scribble.points)) return;
    const targets = scribbleTargetIds(
      scribble.points,
      this.scene.objects.filter((object) => object.id !== scribble.id),
    );
    if (targets.length === 0) return;
    const removed = new Set([scribble.id, ...targets]);
    this.scene = {
      ...this.scene,
      objects: this.scene.objects.filter((object) => !removed.has(object.id)),
    };
    this.renderer.schedule(this.scene);
  }

  private abortTransaction() {
    if (this.transactionBaseline) this.scene = this.transactionBaseline;
    this.transactionBaseline = null;
    this.activePenStrokeId = null;
    this.snappedStroke = null;
    this.pen.cancel();
    this.pixelEraser.cancel();
    this.clearGesture();
    this.renderer.schedule(this.scene);
  }
}
