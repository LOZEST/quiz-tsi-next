import { useEffect, useRef } from 'react';
import { useRevisionExperience } from './RevisionExperienceProvider';
import styles from './QuestionChangeDialog.module.css';

export function QuestionChangeDialog() {
  const experience = useRevisionExperience();
  const cancel = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!experience.pendingChange) return;
    const trigger = experience.dialogTrigger;
    cancel.current?.focus();
    return () => trigger?.focus();
  }, [experience.dialogTrigger, experience.pendingChange]);
  if (!experience.pendingChange) return null;
  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) experience.cancelChange();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-question-title"
        aria-describedby="change-question-description"
        className={styles.dialog}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            experience.cancelChange();
            return;
          }
          if (event.key !== 'Tab') return;
          const controls = dialog.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          if (!controls?.length) return;
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <h2 id="change-question-title">Changer de question</h2>
        <p id="change-question-description">
          Changer de question effacera le travail en cours.
        </p>
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
