import type { WhiteboardScene } from '@domain/whiteboard/WhiteboardScene';
import { pointFromPointerEvent, type PointerInput } from '../model/Point';
import { snapshotScene } from '../model/WhiteboardSnapshot';
import { CanvasCoordinates } from './CanvasCoordinates';
import { CanvasRenderer } from './CanvasRenderer';
import { EraserTool } from '../tools/EraserTool';
import { PenTool } from '../tools/PenTool';
import { ToolManager } from '../tools/ToolManager';

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
    this.undoStack.push(snapshotScene(this.scene).scene);
    this.redoStack = [];
    this.scene = this.tools.current.begin(this.scene, this.input(event)).scene;
    this.renderer.schedule(this.scene);
  }

  pointerMove(event: PointerEvent) {
    if (!this.isActivePointer(event)) return;
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
    this.scene = this.tools.current.end(this.scene, this.input(event)).scene;
    this.finishPointer(event.pointerId, true);
    this.commit();
  }

  pointerCancel(event: PointerEvent) {
    if (!this.isActivePointer(event)) return;
    this.finishPointer(event.pointerId, true);
    this.commit();
  }

  lostPointerCapture(event: PointerEvent) {
    if (!this.isActivePointer(event)) return;
    this.finishPointer(event.pointerId, false);
    this.commit();
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

  selectTool(tool: 'pen' | 'eraser') {
    this.tools.select(tool);
  }
  setPenWidth(width: number) {
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
}
