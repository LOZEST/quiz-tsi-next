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
        ↶
      </button>
      <button type="button" onClick={() => board.redo()} aria-label="Rétablir">
        ↷
      </button>
    </div>
  );
}
