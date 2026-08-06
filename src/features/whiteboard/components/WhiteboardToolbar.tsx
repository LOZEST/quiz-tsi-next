import { useWhiteboard } from '@app/providers/WhiteboardProvider';
import styles from './Whiteboard.module.css';

export function WhiteboardToolbar() {
  const board = useWhiteboard();
  return (
    <div
      className={`${styles.toolbar} ${board.handedness === 'left' ? styles.toolbarLeft : ''}`}
      role="toolbar"
      aria-label="Outils du tableau blanc"
    >
      <button
        type="button"
        aria-pressed={board.activeTool === 'pen'}
        onClick={() => board.setActiveTool('pen')}
      >
        Stylo
      </button>
      <button
        type="button"
        aria-pressed={board.activeTool === 'eraser'}
        onClick={() => board.setActiveTool('eraser')}
      >
        Gomme
      </button>
      <button
        type="button"
        aria-pressed={board.gridEnabled}
        onClick={() => board.setGridEnabled(!board.gridEnabled)}
      >
        Grille
      </button>
      <button type="button" onClick={() => board.undo()} aria-label="Annuler">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 7 4 12l5 5" />
          <path d="M5 12h9a5 5 0 0 1 0 10h-1" />
        </svg>
      </button>
      <button type="button" onClick={() => board.redo()} aria-label="Rétablir">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m15 7 5 5-5 5" />
          <path d="M19 12h-9a5 5 0 0 0 0 10h1" />
        </svg>
      </button>
    </div>
  );
}
