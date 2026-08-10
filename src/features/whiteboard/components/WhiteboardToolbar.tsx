import { useWhiteboard } from '@app/providers/WhiteboardProvider';
import styles from './Whiteboard.module.css';
import { useEffect, useRef, useState } from 'react';
import {
  WHITEBOARD_SHAPE_KINDS,
  type WhiteboardShapeKind,
} from '@domain/whiteboard/WhiteboardShape';

const labels: Record<WhiteboardShapeKind, string> = {
  line: 'Ligne',
  arrow: 'Flèche',
  rectangle: 'Rectangle',
  square: 'Carré',
  circle: 'Cercle',
  triangle: 'Triangle',
  axes: 'Axes',
  'coordinate-system': 'Repère',
  'trigonometric-circle': 'Cercle trigonométrique',
};

export function WhiteboardToolbar() {
  const board = useWhiteboard();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label="Outils du tableau blanc"
      data-handedness={board.handedness}
    >
      <div
        className={styles.toolPalette}
        role="group"
        aria-label="Outils d’écriture"
      >
        <button
          type="button"
          aria-label="Stylo"
          aria-pressed={board.activeTool === 'pen'}
          onClick={() => board.setActiveTool('pen')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m14.5 4.5 5 5" />
            <path d="m4 20 4.3-1 10.8-10.8a1.8 1.8 0 0 0-2.6-2.6L5.7 16.4 4 20Z" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Gomme"
          aria-pressed={board.activeTool === 'eraser'}
          onClick={() => board.setActiveTool('eraser')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m7 19 11-11 3 3-8 8H7Z" />
            <path d="m5 17 7-7 3 3-6 6H5Z" />
          </svg>
        </button>
        <button
          ref={trigger}
          type="button"
          aria-label="Formes"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-pressed={
            board.activeTool === 'shape' || board.activeTool === 'select'
          }
          onClick={() => setOpen((value) => !value)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 18 10 7l4 11H4ZM15 5h5v5h-5z" />
          </svg>
        </button>
        {open ? (
          <div
            className={styles.shapePicker}
            role="menu"
            aria-label="Choisir une forme"
          >
            <button
              type="button"
              role="menuitemradio"
              aria-checked={board.activeTool === 'select'}
              onClick={() => {
                board.setActiveTool('select');
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Sélection
            </button>
            {WHITEBOARD_SHAPE_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                role="menuitemradio"
                aria-checked={
                  board.activeTool === 'shape' && board.shapeKind === kind
                }
                onClick={() => {
                  board.setShapeKind(kind);
                  board.setActiveTool('shape');
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                {labels[kind]}
              </button>
            ))}
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
