import styles from './Whiteboard.module.css';

export function QuestionActions({
  active,
  onNext,
}: {
  active: boolean;
  onNext?: (trigger?: HTMLElement) => void;
}) {
  return (
    <div
      className={styles.questionActions}
      role="group"
      aria-label="Actions de la question"
    >
      <button type="button" aria-label="Indice" disabled>
        Indice
      </button>
      <button type="button" aria-label="Correction" disabled>
        Correction
      </button>
      <button
        type="button"
        aria-label="Suivante"
        disabled={!active}
        onClick={(event) => onNext?.(event.currentTarget)}
      >
        Suivante
      </button>
    </div>
  );
}
