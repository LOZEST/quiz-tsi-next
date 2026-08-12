import { useWhiteboard } from '@app/providers/WhiteboardProvider';
import styles from './Whiteboard.module.css';
import { useEffect, useRef, useState } from 'react';
import {
  WHITEBOARD_PALETTE_SHAPE_KINDS,
  type WhiteboardPaletteShapeKind,
} from '@domain/whiteboard/WhiteboardShape';
import { WhiteboardShapePreview } from './WhiteboardShapePreview';

const labels: Record<WhiteboardPaletteShapeKind, string> = {
  'grid-coordinate-system': 'Repère quadrillé',
  'graduated-coordinate-system': 'Repère gradué',
  'trigonometric-circle': 'Cercle trigonométrique',
  'sign-chart': 'Tableau de signes/variations',
};

export function WhiteboardToolbar() {
  const board = useWhiteboard();
  const [shapesOpen, setShapesOpen] = useState(false);
  const toolbar = useRef<HTMLDivElement>(null);
  const shapesTrigger = useRef<HTMLButtonElement>(null);
  const eraserActive = board.activeTool === 'eraser';
  const writingLabel = eraserActive ? 'Gomme' : 'Stylo';
  useEffect(() => {
    if (!shapesOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShapesOpen(false);
        shapesTrigger.current?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !toolbar.current?.contains(event.target)
      )
        setShapesOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [shapesOpen]);
  return (
    <div
      ref={toolbar}
      className={styles.toolbar}
      role="toolbar"
      aria-label="Outils du tableau blanc"
      data-handedness={board.handedness}
    >
      <div
        className={styles.toolPalette}
        role="group"
        aria-label="Outils principaux"
      >
        <button
          type="button"
          aria-label={writingLabel}
          aria-pressed={
            board.activeTool === 'pen' || board.activeTool === 'eraser'
          }
          onClick={() =>
            board.setActiveTool(board.activeTool === 'pen' ? 'eraser' : 'pen')
          }
        >
          {eraserActive ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m7.5 18.5-3-3a2 2 0 0 1 0-2.8l7.2-7.2a2 2 0 0 1 2.8 0l4 4a2 2 0 0 1 0 2.8l-6.2 6.2H7.5Z" />
              <path d="m9 8 7 7M11.8 18.5H20" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m14.5 4.5 5 5" />
              <path d="m4 20 4.3-1 10.8-10.8a1.8 1.8 0 0 0-2.6-2.6L5.7 16.4 4 20Z" />
            </svg>
          )}
          <span>{writingLabel}</span>
        </button>
        <button
          ref={shapesTrigger}
          type="button"
          aria-label="Formes"
          aria-expanded={shapesOpen}
          aria-haspopup="menu"
          aria-pressed={
            board.activeTool === 'shape' || board.activeTool === 'select'
          }
          onClick={() => setShapesOpen((value) => !value)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 18 10 7l4 11H4ZM15 5h5v5h-5z" />
          </svg>
          <span>Formes</span>
        </button>
        {shapesOpen ? (
          <div
            className={styles.shapePicker}
            role="menu"
            aria-label="Choisir une forme"
          >
            <button
              className={styles.selectionAction}
              type="button"
              role="menuitem"
              aria-current={board.activeTool === 'select' ? 'true' : undefined}
              onClick={() => {
                board.setActiveTool('select');
                setShapesOpen(false);
                shapesTrigger.current?.focus();
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="m5 3 13 8-6 2-3 6L5 3Z" />
              </svg>
              <span>Sélectionner et modifier une forme</span>
            </button>
            <div
              className={styles.shapeGrid}
              role="group"
              aria-label="Formes mathématiques"
            >
              {WHITEBOARD_PALETTE_SHAPE_KINDS.map((kind) => (
                <button
                  className={styles.shapeCard}
                  data-testid="shape-option"
                  key={kind}
                  type="button"
                  role="menuitemradio"
                  aria-label={labels[kind]}
                  aria-checked={
                    board.activeTool === 'shape' && board.shapeKind === kind
                  }
                  onClick={() => {
                    board.setShapeKind(kind);
                    board.setActiveTool('shape');
                    setShapesOpen(false);
                    shapesTrigger.current?.focus();
                  }}
                >
                  <WhiteboardShapePreview kind={kind} />
                  <span>{labels[kind]}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div
        className={styles.historyControls}
        role="group"
        aria-label="Historique"
      >
        <button type="button" onClick={() => board.undo()} aria-label="Annuler">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 7 4 12l5 5" />
            <path d="M5 12h9a5 5 0 0 1 0 10h-1" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => board.redo()}
          aria-label="Rétablir"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m15 7 5 5-5 5" />
            <path d="M19 12h-9a5 5 0 0 0 0 10h1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
