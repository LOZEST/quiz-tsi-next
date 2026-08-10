import type {
  WhiteboardObject,
  WhiteboardScene,
} from '@domain/whiteboard/WhiteboardScene';
import type { PointerInput } from '../model/Point';
import type { Tool, ToolResult } from './Tool';
import { hitTestShape } from '@domain/whiteboard/WhiteboardShape';

function segmentDistanceSquared(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return (px - x) ** 2 + (py - y) ** 2;
}

export function objectCollides(
  object: WhiteboardObject,
  x: number,
  y: number,
  radius = 12,
): boolean {
  if (object.kind === 'shape') return hitTestShape(object, { x, y }, radius);
  if (object.points.length === 1) {
    return (
      segmentDistanceSquared(
        x,
        y,
        object.points[0]!.x,
        object.points[0]!.y,
        object.points[0]!.x,
        object.points[0]!.y,
      ) <=
      radius ** 2
    );
  }
  return object.points.slice(1).some((point, index) => {
    const previous = object.points[index]!;
    return (
      segmentDistanceSquared(x, y, previous.x, previous.y, point.x, point.y) <=
      (radius + object.width / 2) ** 2
    );
  });
}

export class EraserTool implements Tool {
  readonly id = 'eraser';

  private erase(scene: WhiteboardScene, input: PointerInput): ToolResult {
    const objects = scene.objects.filter(
      (object) => !objectCollides(object, input.point.x, input.point.y),
    );
    return {
      scene: { ...scene, objects },
      changed: objects.length !== scene.objects.length,
    };
  }

  begin(scene: WhiteboardScene, input: PointerInput) {
    return this.erase(scene, input);
  }
  move(scene: WhiteboardScene, input: PointerInput) {
    return this.erase(scene, input);
  }
  end(scene: WhiteboardScene, input: PointerInput) {
    return this.erase(scene, input);
  }
}
