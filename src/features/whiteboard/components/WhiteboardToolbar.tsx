import { useWhiteboard } from '@app/providers/WhiteboardProvider';
import styles from './Whiteboard.module.css';

export function WhiteboardToolbar() {
  const board = useWhiteboard();
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
          type="button"
          aria-label="Formes — bientôt disponible"
          title="Formes — bientôt disponible"
          disabled
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 5h7v7H4zM16 5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" />
            <path d="m8 12 4 7H4l4-7ZM16 12h4v7h-7l3-7Z" />
          </svg>
        </button>
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
