import { useEffect, useRef, type ReactNode } from 'react';
import { QuestionContentRenderer } from '@features/questions/QuestionContentRenderer';
import type { InstantiatedQuestion } from '@domain/questions/QuestionInstantiation';
import styles from './RevisionExperience.module.css';

export function QuestionHelpPanels({
  content,
  hintOpen,
  correctionOpen,
  onCloseHint,
  onCloseCorrection,
}: {
  content: InstantiatedQuestion;
  hintOpen: boolean;
  correctionOpen: boolean;
  onCloseHint: () => void;
  onCloseCorrection: () => void;
}) {
  return (
    <>
      {hintOpen ? (
        <HelpPanel
          id="question-hint-panel"
          title="Indice"
          onClose={onCloseHint}
        >
          <QuestionContentRenderer segments={content.hint} />
        </HelpPanel>
      ) : null}
      {correctionOpen ? (
        <HelpPanel
          id="question-correction-panel"
          title="Correction"
          onClose={onCloseCorrection}
        >
          {content.correction.map((step) => (
            <section key={step.id}>
              {step.title ? <h3>{step.title}</h3> : null}
              <QuestionContentRenderer segments={step.content} />
            </section>
          ))}
        </HelpPanel>
      ) : null}
    </>
  );
}

function HelpPanel({
  id,
  title,
  onClose,
  children,
}: {
  id: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  return (
    <aside
      id={id}
      className={`${styles.helpPanel} ${title === 'Correction' ? styles.correctionBubble : ''}`}
      aria-labelledby={`${id}-title`}
    >
      <header>
        <h2 id={`${id}-title`}>{title}</h2>
        <button ref={close} type="button" onClick={onClose}>
          Fermer
        </button>
      </header>
      <div className={styles.helpPanelContent}>{children}</div>
    </aside>
  );
}
