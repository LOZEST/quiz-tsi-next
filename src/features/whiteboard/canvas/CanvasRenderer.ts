import type {
  WhiteboardObject,
  WhiteboardScene,
} from '@domain/whiteboard/WhiteboardScene';
import { GridRenderer } from './GridRenderer';

export class CanvasRenderer {
  private frame: number | null = null;
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly grid = new GridRenderer(),
  ) {}

  setGrid(enabled: boolean) {
    this.grid.enabled = enabled;
  }

  schedule(scene: WhiteboardScene) {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.render(scene);
    });
  }

  render(scene: WhiteboardScene) {
    const context = this.canvas.getContext('2d');
    if (!context) return;
    const ratio = this.canvas.width / Math.max(1, this.canvas.clientWidth);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    this.grid.render(
      context,
      this.canvas.clientWidth,
      this.canvas.clientHeight,
    );
    const scale = Math.min(
      this.canvas.clientWidth / scene.logicalWidth,
      this.canvas.clientHeight / scene.logicalHeight,
    );
    const offsetX = (this.canvas.clientWidth - scene.logicalWidth * scale) / 2;
    const offsetY =
      (this.canvas.clientHeight - scene.logicalHeight * scale) / 2;
    context.save();
    context.translate(offsetX, offsetY);
    context.scale(scale, scale);
    scene.objects.forEach((object) => this.drawObject(context, object));
    context.restore();
  }

  private drawObject(
    context: CanvasRenderingContext2D,
    object: WhiteboardObject,
  ) {
    context.save();
    context.strokeStyle = object.color;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const first = object.points[0];
    if (!first) return;
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (let index = 1; index < object.points.length; index += 1) {
      const previous = object.points[index - 1]!;
      const point = object.points[index]!;
      context.lineWidth =
        object.width * (0.55 + Math.max(point.pressure, 0.1) * 0.9);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    }
    if (object.points.length === 1) {
      context.fillStyle = object.color;
      context.beginPath();
      context.arc(first.x, first.y, object.width / 2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  destroy() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
  }
}
