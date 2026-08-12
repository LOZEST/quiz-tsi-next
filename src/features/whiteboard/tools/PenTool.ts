import type { WhiteboardScene } from '@domain/whiteboard/WhiteboardScene';
import { createStroke } from '../model/Stroke';
import type { PointerInput } from '../model/Point';
import type { Tool, ToolResult } from './Tool';

export class PenTool implements Tool {
  readonly id = 'pen';
  private activeStrokeId: string | null = null;

  constructor(private width = 3) {}

  setWidth(width: number) {
    this.width = width;
  }

  cancel() {
    this.activeStrokeId = null;
  }

  begin(scene: WhiteboardScene, input: PointerInput): ToolResult {
    const stroke = createStroke(input.point, this.width);
    this.activeStrokeId = stroke.id;
    return {
      scene: { ...scene, objects: [...scene.objects, stroke] },
      changed: true,
    };
  }

  move(scene: WhiteboardScene, input: PointerInput): ToolResult {
    if (!this.activeStrokeId) return { scene, changed: false };
    return {
      scene: {
        ...scene,
        objects: scene.objects.map((object) =>
          object.kind === 'stroke' && object.id === this.activeStrokeId
            ? { ...object, points: [...object.points, input.point] }
            : object,
        ),
      },
      changed: true,
    };
  }

  end(scene: WhiteboardScene, input: PointerInput): ToolResult {
    const result = this.move(scene, input);
    this.activeStrokeId = null;
    return result;
  }
}
