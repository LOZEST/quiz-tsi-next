import { useState } from 'react';
import { useAppServices } from '@app/providers/AppServicesProvider';
import type { PreparedQuestion } from '@domain/questions/PreparedQuestion';
import type { Question } from '@domain/questions/Question';
import { QuestionContentRenderer } from './QuestionContentRenderer';
import { ReflexTimer } from '@features/session/ReflexTimer';
import styles from './QuestionCard.module.css';

const typeLabels = {
  formula: 'Formules',
  course: 'Cours',
  calculation: 'Calcul',
  reflex: 'Réflexe',
} as const;
export function QuestionCard({
  prepared,
  question,
  onNext,
}: {
  prepared: PreparedQuestion;
  question: Readonly<Question>;
  onNext: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { clock } = useAppServices();
  return (
    <article className={styles.card} aria-label="Question active">
      <header>
        <span>{typeLabels[question.type]}</span>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? 'Afficher la question' : 'Réduire'}
        </button>
      </header>
      {!collapsed ? (
        <>
          <div className={styles.prompt}>
            <QuestionContentRenderer segments={prepared.content.prompt} />
          </div>
          {question.type === 'reflex' ? (
            <ReflexTimer
              key={`${prepared.questionId}:${prepared.seed}`}
              activationKey={`${prepared.questionId}:${prepared.seed}`}
              clock={clock}
            />
          ) : null}
          <button type="button" onClick={() => onNext()}>
            Question suivante
          </button>
        </>
      ) : null}
    </article>
  );
}
