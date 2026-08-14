import type {
  WhiteboardObject,
  WhiteboardScene,
  WhiteboardStroke,
} from '@domain/whiteboard/WhiteboardScene';
import { GridRenderer } from './GridRenderer';
import { drawStrokeOutline, strokeOutline } from './strokeOutline';
import type { Vec2 } from 'perfect-freehand';
import {
  resizeHandlePosition,
  rotationHandlePosition,
  shapeLocalPointToWorld,
  shapePrimitives,
} from '@domain/whiteboard/WhiteboardShape';

export class CanvasRenderer {
  private frame: number | null = null;
  private selectedShapeId: string | null = null;
  private strokeOutlineCache = new WeakMap<WhiteboardStroke, Vec2[]>();
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
    if (object.kind === 'eraser-mask') {
      const first = object.points[0];
      if (!first) return;
      context.save();
      context.globalCompositeOperation = 'destination-out';
      context.strokeStyle = '#000000';
      context.fillStyle = '#000000';
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = object.radius * 2;
      if (object.points.length === 1) {
        context.beginPath();
        context.arc(first.x, first.y, object.radius, 0, Math.PI * 2);
        context.fill();
      } else {
        context.beginPath();
        context.moveTo(first.x, first.y);
        object.points
          .slice(1)
          .forEach((point) => context.lineTo(point.x, point.y));
        context.stroke();
      }
      context.restore();
      return;
    }
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
      context.fillStyle = style.color;
      context.lineCap = style.lineCap;
      context.lineJoin = style.lineJoin;
      for (const primitive of shapePrimitives(object)) {
        const roleOpacity =
          primitive.role === 'faint'
            ? 0.24
            : primitive.role === 'secondary'
              ? 0.58
              : 1;
        context.globalAlpha = style.opacity * roleOpacity;
        context.lineWidth = style.width * (primitive.widthScale ?? 1);
        if (primitive.kind === 'text') {
          context.font = `${primitive.fontSize}px ui-sans-serif, system-ui, sans-serif`;
          context.textAlign = primitive.align;
          context.textBaseline = 'middle';
          context.fillText(
            primitive.value,
            primitive.position.x,
            primitive.position.y,
          );
          continue;
        }
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
        if (primitive.filled) context.fill();
        else context.stroke();
      }
      context.restore();
      if (object.id === this.selectedShapeId)
        this.drawSelection(context, object);
      return;
    }
    if (!object.points.length) return;
    context.save();
    if (object.snap) {
      context.strokeStyle = object.color;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = object.width;
      context.beginPath();
      const [first, ...rest] = object.points;
      context.moveTo(first!.x, first!.y);
      rest.forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
    } else {
      context.fillStyle = object.color;
      drawStrokeOutline(context, this.strokeOutline(object));
    }
    context.restore();
  }

  private strokeOutline(object: WhiteboardStroke): Vec2[] {
    const cached = this.strokeOutlineCache.get(object);
    if (cached) return cached;
    const outline = strokeOutline(object);
    this.strokeOutlineCache.set(object, outline);
    return outline;
  }

  private drawSelection(
    context: CanvasRenderingContext2D,
    shape: Extract<WhiteboardObject, { kind: 'shape' }>,
  ) {
    const { width, height } = shape.geometry;
    const corners = [
      shapeLocalPointToWorld(shape, { x: 0, y: 0 }),
      shapeLocalPointToWorld(shape, { x: width, y: 0 }),
      shapeLocalPointToWorld(shape, { x: width, y: height }),
      shapeLocalPointToWorld(shape, { x: 0, y: height }),
    ];
    const resizeHandle = resizeHandlePosition(shape);
    const rotationHandle = rotationHandlePosition(shape);
    context.save();
    context.strokeStyle = '#0a66d8';
    context.lineWidth = 1.5;
    context.setLineDash([5, 4]);
    context.beginPath();
    context.moveTo(corners[0]!.x, corners[0]!.y);
    corners.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.closePath();
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#0a66d8';
    context.beginPath();
    context.arc(resizeHandle.x, resizeHandle.y, 6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    if (rotationHandle) {
      const topCenter = shapeLocalPointToWorld(shape, { x: width / 2, y: 0 });
      context.beginPath();
      context.moveTo(topCenter.x, topCenter.y);
      context.lineTo(rotationHandle.x, rotationHandle.y);
      context.stroke();
      context.beginPath();
      context.arc(rotationHandle.x, rotationHandle.y, 6, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  destroy() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
  }
}
