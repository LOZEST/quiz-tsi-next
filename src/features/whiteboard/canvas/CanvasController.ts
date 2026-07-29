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
  private drawing = false;
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
    if (event.pointerType === 'touch') return;
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    this.undoStack.push(snapshotScene(this.scene).scene);
    this.redoStack = [];
    this.drawing = true;
    this.scene = this.tools.current.begin(this.scene, this.input(event)).scene;
    this.renderer.schedule(this.scene);
  }

  pointerMove(event: PointerEvent) {
    if (!this.drawing) return;
    const coalesced = event.getCoalescedEvents?.() ?? [event];
    for (const sample of coalesced) {
      this.scene = this.tools.current.move(
        this.scene,
        this.input(sample),
      ).scene;
    }
    this.renderer.schedule(this.scene);
  }

  pointerUp(event: PointerEvent) {
    if (!this.drawing) return;
    this.scene = this.tools.current.end(this.scene, this.input(event)).scene;
    this.drawing = false;
    this.canvas.releasePointerCapture(event.pointerId);
    this.commit();
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
    this.resizeObserver?.disconnect();
    this.renderer.destroy();
  }
}
