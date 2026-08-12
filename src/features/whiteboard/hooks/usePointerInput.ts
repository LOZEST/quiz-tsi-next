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
    const cancel = (event: PointerEvent) => controller.pointerCancel(event);
    const lostCapture = (event: PointerEvent) =>
      controller.lostPointerCapture(event);
    const options: AddEventListenerOptions = { passive: false };
    const blockTouch = (event: TouchEvent) => event.preventDefault();
    canvas.addEventListener('pointerdown', down, options);
    canvas.addEventListener('pointermove', move, options);
    canvas.addEventListener('pointerup', up, options);
    canvas.addEventListener('pointercancel', cancel, options);
    canvas.addEventListener('lostpointercapture', lostCapture);
    canvas.addEventListener('touchstart', blockTouch, options);
    canvas.addEventListener('touchmove', blockTouch, options);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('lostpointercapture', lostCapture);
      canvas.removeEventListener('touchstart', blockTouch);
      canvas.removeEventListener('touchmove', blockTouch);
    };
  }, [canvasRef, controller]);
}
