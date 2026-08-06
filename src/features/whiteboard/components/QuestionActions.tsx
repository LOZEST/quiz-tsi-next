import styles from './Whiteboard.module.css';

export function QuestionActions({
  onNext,
}: {
  onNext: (trigger?: HTMLElement) => void;
}) {
  return (
    <div
      className={styles.questionActions}
      role="group"
      aria-label="Actions de la question"
    >
      <button type="button" disabled>
        Indice
      </button>
      <button type="button" disabled>
        Correction
      </button>
      <button type="button" onClick={(event) => onNext(event.currentTarget)}>
        Suivante
      </button>
    </div>
  );
}
