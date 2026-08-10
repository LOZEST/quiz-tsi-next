import type {
  WhiteboardObject,
  WhiteboardScene,
} from '@domain/whiteboard/WhiteboardScene';
import { GridRenderer } from './GridRenderer';
import { shapePrimitives } from '@domain/whiteboard/WhiteboardShape';

export class CanvasRenderer {
  private frame: number | null = null;
  private selectedShapeId: string | null = null;
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly grid = new GridRenderer(),
  ) {}

  setGrid(enabled: boolean) {
    this.grid.enabled = enabled;
  }

  setSelection(id: string | null) {
    this.selectedShapeId = id;
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
    if (object.kind === 'shape') {
      context.save();
      const { geometry, style } = object;
      context.translate(
        geometry.x + geometry.width / 2,
        geometry.y + geometry.height / 2,
      );
      context.rotate(geometry.rotation ?? 0);
      context.translate(-geometry.width / 2, -geometry.height / 2);
      context.strokeStyle = style.color;
      context.globalAlpha = style.opacity;
      context.lineWidth = style.width;
      context.lineCap = style.lineCap;
      context.lineJoin = style.lineJoin;
      for (const primitive of shapePrimitives(object)) {
        context.beginPath();
        if (primitive.kind === 'line') {
          context.moveTo(primitive.from.x, primitive.from.y);
          context.lineTo(primitive.to.x, primitive.to.y);
        } else if (primitive.kind === 'ellipse') {
          context.ellipse(
            primitive.center.x,
            primitive.center.y,
            primitive.radiusX,
            primitive.radiusY,
            0,
            0,
            Math.PI * 2,
          );
        } else {
          const first = primitive.points[0];
          if (!first) continue;
          context.moveTo(first.x, first.y);
          primitive.points
            .slice(1)
            .forEach((point) => context.lineTo(point.x, point.y));
          if (primitive.closed) context.closePath();
        }
        context.stroke();
      }
      context.restore();
      if (object.id === this.selectedShapeId)
        this.drawSelection(context, object);
      return;
    }
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

  private drawSelection(
    context: CanvasRenderingContext2D,
    shape: Extract<WhiteboardObject, { kind: 'shape' }>,
  ) {
    const { x, y, width, height, rotation } = shape.geometry;
    context.save();
    context.translate(x + width / 2, y + height / 2);
    context.rotate(rotation ?? 0);
    context.translate(-width / 2, -height / 2);
    context.strokeStyle = '#0a66d8';
    context.lineWidth = 1.5;
    context.setLineDash([5, 4]);
    context.strokeRect(0, 0, width, height);
    context.setLineDash([]);
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#0a66d8';
    context.beginPath();
    context.arc(width, height, 6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    if (rotation !== null) {
      context.beginPath();
      context.moveTo(width / 2, 0);
      context.lineTo(width / 2, -24);
      context.stroke();
      context.beginPath();
      context.arc(width / 2, -24, 6, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  destroy() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
  }
}
