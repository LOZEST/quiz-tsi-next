import type { WhiteboardStroke } from '@domain/whiteboard/WhiteboardScene';
import type { Point } from './Point';

export function createStroke(
  point: Point,
  width: number,
  id: string = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
): WhiteboardStroke {
  return {
    kind: 'stroke',
    id,
    tool: 'pen',
    points: [point],
    width,
    color: '#1d1d1f',
    createdAt,
  };
}
