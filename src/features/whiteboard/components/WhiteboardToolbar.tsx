import { useWhiteboard } from '@app/providers/WhiteboardProvider';
import styles from './Whiteboard.module.css';
import { useEffect, useRef, useState } from 'react';
import {
  WHITEBOARD_SHAPE_KINDS,
  type WhiteboardShapeKind,
} from '@domain/whiteboard/WhiteboardShape';

const labels: Record<WhiteboardShapeKind, string> = {
  line: 'Droite',
  arrow: 'Flèche',
  rectangle: 'Rectangle',
  square: 'Carré',
  circle: 'Cercle',
  triangle: 'Triangle',
  axes: 'Axes',
  'coordinate-system': 'Repère orthonormé',
  'trigonometric-circle': 'Cercle trigonométrique',
  'sign-chart': 'Tableau de signes',
};

export function WhiteboardToolbar() {
  const board = useWhiteboard();
  const [openMenu, setOpenMenu] = useState<'pen' | 'shapes' | null>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const penTrigger = useRef<HTMLButtonElement>(null);
  const shapesTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!openMenu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const activeTrigger =
          openMenu === 'pen' ? penTrigger.current : shapesTrigger.current;
        setOpenMenu(null);
        activeTrigger?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !toolbar.current?.contains(event.target)
      )
        setOpenMenu(null);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [openMenu]);
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
          ref={penTrigger}
          type="button"
          aria-label="Stylo"
          aria-expanded={openMenu === 'pen'}
          aria-haspopup="menu"
          aria-pressed={
            board.activeTool === 'pen' || board.activeTool === 'eraser'
          }
          onClick={() =>
            setOpenMenu((value) => (value === 'pen' ? null : 'pen'))
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m14.5 4.5 5 5" />
            <path d="m4 20 4.3-1 10.8-10.8a1.8 1.8 0 0 0-2.6-2.6L5.7 16.4 4 20Z" />
          </svg>
          <span>Stylo</span>
        </button>
        {openMenu === 'pen' ? (
          <div
            className={styles.toolPicker}
            role="menu"
            aria-label="Choisir un outil"
          >
            {(['pen', 'eraser'] as const).map((tool) => (
              <button
                key={tool}
                type="button"
                role="menuitemradio"
                aria-checked={board.activeTool === tool}
                onClick={() => {
                  board.setActiveTool(tool);
                  setOpenMenu(null);
                  penTrigger.current?.focus();
                }}
              >
                {tool === 'pen' ? 'Stylo' : 'Gomme'}
              </button>
            ))}
          </div>
        ) : null}
        <button
          ref={shapesTrigger}
          type="button"
          aria-label="Formes"
          aria-expanded={openMenu === 'shapes'}
          aria-haspopup="menu"
          aria-pressed={
            board.activeTool === 'shape' || board.activeTool === 'select'
          }
          onClick={() =>
            setOpenMenu((value) => (value === 'shapes' ? null : 'shapes'))
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 18 10 7l4 11H4ZM15 5h5v5h-5z" />
          </svg>
          <span>Formes</span>
        </button>
        {openMenu === 'shapes' ? (
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
                setOpenMenu(null);
                shapesTrigger.current?.focus();
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
                  setOpenMenu(null);
                  shapesTrigger.current?.focus();
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
