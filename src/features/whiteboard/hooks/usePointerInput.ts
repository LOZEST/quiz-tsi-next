import { useEffect, type RefObject } from 'react';
import type { CanvasController } from '../canvas/CanvasController';

export function usePointerInput(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  controller: CanvasController | null,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !controller) return;
    const down = (event: PointerEvent) => controller.pointerDown(event);
    const move = (event: PointerEvent) => controller.pointerMove(event);
    const up = (event: PointerEvent) => controller.pointerUp(event);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, [canvasRef, controller]);
}
