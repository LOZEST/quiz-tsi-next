import type {
  WhiteboardObject,
  WhiteboardPoint,
  WhiteboardScene,
} from '@domain/whiteboard/WhiteboardScene';
import { eraseStrokeWithPath } from '@domain/whiteboard/PixelErase';
import {
  hitTestShape,
  type WhiteboardShape,
} from '@domain/whiteboard/WhiteboardShape';
import type { PointerInput } from '../model/Point';
import type { Tool, ToolResult } from './Tool';

const DEFAULT_PIXEL_ERASER_RADIUS = 12;

function shapeIntersectsPath(
  shape: WhiteboardShape,
  path: readonly WhiteboardPoint[],
  radius: number,
) {
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1]!;
    const b = path[index]!;
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / radius),
    );
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps;
      if (
        hitTestShape(
          shape,
          { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress },
          radius,
        )
      )
        return true;
    }
  }
  return path.length === 1 && hitTestShape(shape, path[0]!, radius);
}

export class PixelEraserTool implements Tool {
  readonly id = 'eraser';
  private baseline: WhiteboardScene | null = null;
  private path: WhiteboardPoint[] = [];
  private maskId = '';

  constructor(private readonly radius = DEFAULT_PIXEL_ERASER_RADIUS) {}

  begin(scene: WhiteboardScene, input: PointerInput): ToolResult {
    this.baseline = scene;
    this.path = [input.point];
    this.maskId = `eraser-mask-${input.point.timestamp}-${input.pointerId}`;
    return this.erase();
  }

  move(_scene: WhiteboardScene, input: PointerInput): ToolResult {
    if (!this.baseline) return { scene: _scene, changed: false };
    const previous = this.path.at(-1);
    if (
      !previous ||
      previous.x !== input.point.x ||
      previous.y !== input.point.y
    )
      this.path.push(input.point);
    return this.erase();
  }

  end(scene: WhiteboardScene, input: PointerInput): ToolResult {
    const result = this.move(scene, input);
    this.cancel();
    return result;
  }

  cancel() {
    this.baseline = null;
    this.path = [];
    this.maskId = '';
  }

  private erase(): ToolResult {
    const baseline = this.baseline;
    if (!baseline)
      throw new Error('Pixel eraser gesture missing its baseline.');
    let changed = false;
    const objects: WhiteboardObject[] = [];
    for (const object of baseline.objects) {
      if (object.kind !== 'stroke') {
        objects.push(object);
        continue;
      }
      const fragments = eraseStrokeWithPath(object, this.path, this.radius);
      if (fragments.length !== 1 || fragments[0] !== object) changed = true;
      objects.push(...fragments);
    }
    const shapeHit = baseline.objects.some(
      (object) =>
        object.kind === 'shape' &&
        shapeIntersectsPath(object, this.path, this.radius),
    );
    if (shapeHit) {
      changed = true;
      objects.push({
        kind: 'eraser-mask',
        id: this.maskId,
        points: [...this.path],
        radius: this.radius,
        createdAt: new Date().toISOString(),
      });
    }
    return { scene: { ...baseline, objects }, changed };
  }
}
