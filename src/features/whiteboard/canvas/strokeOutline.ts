import { getStroke, type Vec2 } from 'perfect-freehand';
import type { WhiteboardStroke } from '@domain/whiteboard/WhiteboardScene';

export function strokeOutline(stroke: WhiteboardStroke): Vec2[] {
  return getStroke(
    stroke.points.map((point) => [point.x, point.y, point.pressure]),
    {
      size: stroke.width,
      thinning: 0.7,
      smoothing: 0.5,
      streamline: 0.55,
      simulatePressure: false,
      last: true,
    },
  );
}

export function drawStrokeOutline(
  context: CanvasRenderingContext2D,
  outline: Vec2[],
) {
  if (outline.length === 0) return;
  context.beginPath();
  const [firstX, firstY] = outline[0]!;
  if (outline.length < 3) {
    const radius = 0.01;
    context.moveTo(firstX, firstY);
    context.lineTo(firstX + radius, firstY + radius);
    context.fill();
    return;
  }
  context.moveTo(firstX, firstY);
  for (let index = 0; index < outline.length; index += 1) {
    const [x0, y0] = outline[index]!;
    const [x1, y1] = outline[(index + 1) % outline.length]!;
    context.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  context.closePath();
  context.fill();
}
