import type { WhiteboardPoint } from '@domain/whiteboard/WhiteboardScene';

export type Point = WhiteboardPoint;

export interface PointerInput {
  pointerId: number;
  pointerType: 'mouse' | 'pen' | 'touch';
  point: Point;
}

export function pointFromPointerEvent(
  event: PointerEvent,
  x: number,
  y: number,
): Point {
  const pressure =
    event.pointerType === 'mouse' && event.pressure === 0
      ? 0.5
      : Math.max(0, Math.min(1, event.pressure));
  return {
    x,
    y,
    pressure,
    tiltX: event.tiltX,
    tiltY: event.tiltY,
    timestamp: event.timeStamp,
  };
}
