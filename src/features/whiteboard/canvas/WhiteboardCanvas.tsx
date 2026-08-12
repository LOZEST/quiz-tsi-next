import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@app/providers/AuthProvider';
import { useAppServices } from '@app/providers/AppServicesProvider';
import { restoreWhiteboardScene } from '@domain/whiteboard/WhiteboardScene';
import { CanvasController } from './CanvasController';
import { createEmptyScene } from '../model/WhiteboardState';
import { useWhiteboard } from '@app/providers/WhiteboardProvider';
import { usePointerInput } from '../hooks/usePointerInput';
import styles from '../components/Whiteboard.module.css';

export function WhiteboardCanvas({
  sceneId = 'main',
  questionInstanceId = 'whiteboard',
}: {
  sceneId?: string;
  questionInstanceId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [controller, setController] = useState<CanvasController | null>(null);
  const [storageError, setStorageError] = useState(false);
  const { workspaceRepository } = useAppServices();
  const { state } = useAuth();
  const settings = useWhiteboard();
  const { bindHistory, bindDraft } = settings;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || state.status !== 'authenticated') return;
    const { user } = state.session;
    const generation = state.session.workspaceGeneration;
    let disposed = false;
    let activeController: CanvasController | null = null;
    void (
      workspaceRepository.getWhiteboardScene?.(sceneId, generation, user.id) ??
      Promise.resolve(null)
    )
      .then((stored) => {
        if (disposed) return;
        const restored = stored
          ? restoreWhiteboardScene(stored, sceneId).scene
          : null;
        const scene =
          restored?.questionInstanceId === questionInstanceId
            ? restored
            : createEmptyScene(sceneId, questionInstanceId);
        activeController = new CanvasController(canvas, scene, (next) => {
          const persistence = workspaceRepository.saveWhiteboardScene?.(
            next,
            generation,
            user.id,
          );
          void persistence?.catch(() => setStorageError(true));
          bindDraft({
            hasDraft: () => next.objects.length > 0,
            clear: () =>
              activeController?.replaceScene(
                createEmptyScene(sceneId, questionInstanceId),
              ),
          });
        });
        bindDraft({
          hasDraft: () => activeController?.getScene().objects.length !== 0,
          clear: () =>
            activeController?.replaceScene(
              createEmptyScene(sceneId, questionInstanceId),
            ),
        });
        setController(activeController);
      })
      .catch(() => setStorageError(true));
    return () => {
      disposed = true;
      activeController?.destroy();
      bindDraft(null);
      setController(null);
    };
  }, [bindDraft, questionInstanceId, sceneId, state, workspaceRepository]);

  usePointerInput(canvasRef, controller);

  useEffect(() => {
    controller?.selectTool(settings.activeTool, settings.shapeKind);
  }, [controller, settings.activeTool, settings.shapeKind]);
  useEffect(
    () => controller?.setPenWidth(settings.penWidth),
    [controller, settings.penWidth],
  );
  useEffect(
    () => controller?.setGrid(settings.gridEnabled),
    [controller, settings.gridEnabled],
  );
  useEffect(
    () => controller?.setMagicShapes(settings.magicShapesEnabled),
    [controller, settings.magicShapesEnabled],
  );
  useEffect(() => {
    bindHistory(
      controller
        ? { undo: () => controller.undo(), redo: () => controller.redo() }
        : null,
    );
    return () => bindHistory(null);
  }, [bindHistory, controller]);
  useEffect(() => {
    if (!controller) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') controller.cancelInteraction();
    };
    document.addEventListener('keydown', cancel);
    return () => document.removeEventListener('keydown', cancel);
  }, [controller]);

  return (
    <>
      {storageError ? (
        <p className={styles.storageError} role="alert">
          Le brouillon local est indisponible. Recharge la page pour réessayer.
        </p>
      ) : null}
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="Zone d’écriture du tableau blanc"
        data-testid="whiteboard-canvas"
      />
    </>
  );
}
