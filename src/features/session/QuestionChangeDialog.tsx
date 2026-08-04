import { useEffect, useRef } from 'react';
import { useRevisionExperience } from './RevisionExperienceProvider';
import styles from './QuestionChangeDialog.module.css';

export function QuestionChangeDialog() {
  const experience = useRevisionExperience();
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (experience.pendingChange) cancel.current?.focus();
  }, [experience.pendingChange]);
  if (!experience.pendingChange) return null;
  return (
    <div className={styles.backdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-question-title"
        className={styles.dialog}
      >
        <h2 id="change-question-title">
          Changer de question effacera le travail en cours.
        </h2>
        <div>
          <button type="button" onClick={() => experience.confirmChange()}>
            Changer maintenant
          </button>
          <button
            ref={cancel}
            type="button"
            onClick={() => experience.cancelChange()}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
