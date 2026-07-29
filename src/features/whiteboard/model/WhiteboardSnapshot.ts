import type { WhiteboardScene } from '@domain/whiteboard/WhiteboardScene';

export interface WhiteboardSnapshot {
  scene: WhiteboardScene;
  capturedAt: string;
}

export function snapshotScene(scene: WhiteboardScene): WhiteboardSnapshot {
  return {
    scene: structuredClone(scene),
    capturedAt: new Date().toISOString(),
  };
}
