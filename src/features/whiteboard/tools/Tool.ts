import type { WhiteboardScene } from '@domain/whiteboard/WhiteboardScene';
import type { PointerInput } from '../model/Point';

export interface ToolResult {
  scene: WhiteboardScene;
  changed: boolean;
}

export interface Tool {
  readonly id: 'pen' | 'eraser';
  begin(scene: WhiteboardScene, input: PointerInput): ToolResult;
  move(scene: WhiteboardScene, input: PointerInput): ToolResult;
  end(scene: WhiteboardScene, input: PointerInput): ToolResult;
}
