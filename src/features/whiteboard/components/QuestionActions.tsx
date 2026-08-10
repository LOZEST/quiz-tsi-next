import styles from './Whiteboard.module.css';

export function QuestionActions({
  active,
  hasHint = false,
  hasCorrection = false,
  hintOpen = false,
  correctionOpen = false,
  completed = false,
  onHint,
  onCorrection,
  onEvaluate,
  onNext,
}: {
  active: boolean;
  hasHint?: boolean;
  hasCorrection?: boolean;
  hintOpen?: boolean;
  correctionOpen?: boolean;
  completed?: boolean;
  onHint?: (trigger: HTMLElement) => void;
  onCorrection?: (trigger: HTMLElement) => void;
  onEvaluate?: (action: 'success' | 'failed' | 'skipped') => void;
  onNext?: (trigger?: HTMLElement) => void;
}) {
  return (
    <div
      className={styles.questionActions}
      role="group"
      aria-label="Actions de la question"
    >
      {!correctionOpen && !completed ? (
        <>
          <button
            type="button"
            aria-label={hasHint ? 'Indice' : 'Indice indisponible'}
            aria-expanded={hintOpen}
            aria-controls="question-hint-panel"
            disabled={!active || !hasHint}
            onClick={(event) => onHint?.(event.currentTarget)}
          >
            Indice
          </button>
          <button
            type="button"
            aria-label={
              hasCorrection ? 'Voir la correction' : 'Correction indisponible'
            }
            aria-expanded={correctionOpen}
            aria-controls="question-correction-panel"
            disabled={!active || !hasCorrection}
            onClick={(event) => onCorrection?.(event.currentTarget)}
          >
            Voir la correction
          </button>
          <button
            type="button"
            disabled={!active}
            onClick={() => onEvaluate?.('skipped')}
          >
            Passer
          </button>
        </>
      ) : null}
      {correctionOpen && !completed ? (
        <>
          <button type="button" onClick={() => onEvaluate?.('success')}>
            Réussi
          </button>
          <button type="button" onClick={() => onEvaluate?.('failed')}>
            Raté
          </button>
          <button
            type="button"
            aria-label="Question suivante"
            onClick={(event) => onNext?.(event.currentTarget)}
          >
            Question suivante
          </button>
        </>
      ) : null}
      {completed ? (
        <button
          type="button"
          aria-label="Question suivante"
          onClick={(event) => onNext?.(event.currentTarget)}
        >
          Question suivante
        </button>
      ) : null}
    </div>
  );
}
