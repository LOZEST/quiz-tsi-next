import type {
  WhiteboardObject,
  WhiteboardScene,
} from '@domain/whiteboard/WhiteboardScene';

export interface WhiteboardState {
  scene: WhiteboardScene;
  gridEnabled: boolean;
  activeTool: 'pen' | 'eraser';
  penWidth: number;
  handedness: 'left' | 'right';
}

export function createEmptyScene(
  sceneId = 'main',
  questionInstanceId = 'whiteboard',
): WhiteboardScene {
  return {
    schemaVersion: 1,
    sceneId,
    questionInstanceId,
    logicalWidth: 1024,
    logicalHeight: 768,
    objects: [],
    updatedAt: new Date().toISOString(),
  };
}

export function withObjects(
  scene: WhiteboardScene,
  objects: WhiteboardObject[],
): WhiteboardScene {
  return { ...scene, objects, updatedAt: new Date().toISOString() };
}
