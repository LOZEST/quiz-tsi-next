import { useState } from 'react';
import { useAppServices } from '@app/providers/AppServicesProvider';
import type { PreparedQuestion } from '@domain/questions/PreparedQuestion';
import {
  questionClassification,
  type Question,
} from '@domain/questions/Question';
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
  reflexDeadline,
  onReflexExceeded,
}: {
  prepared: PreparedQuestion;
  question: Readonly<Question>;
  reflexDeadline: number | null;
  onReflexExceeded?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { clock, programIndex } = useAppServices();
  const classification = questionClassification(question);
  const notion =
    classification?.kind === 'official'
      ? programIndex?.getNotion(classification.notionId)
      : null;
  const chapter =
    classification?.kind === 'official'
      ? programIndex?.getChapter(classification.chapterId)
      : null;
  const contextLabel = notion?.label ?? chapter?.label ?? null;
  return (
    <article className={styles.card} aria-label="Question active">
      <header>
        <span>
          {contextLabel ? `${contextLabel} · ` : ''}
          {typeLabels[question.type]}
        </span>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? 'Afficher la question' : 'Réduire'}
        </button>
      </header>
      {question.type === 'reflex' ? (
        <div hidden={collapsed}>
          <ReflexTimer
            key={`${prepared.questionId}:${prepared.questionVersion}:${prepared.seed}`}
            activationKey={`${prepared.questionId}:${prepared.questionVersion}:${prepared.seed}`}
            clock={clock}
            deadline={reflexDeadline}
            {...(onReflexExceeded ? { onExceeded: onReflexExceeded } : {})}
          />
        </div>
      ) : null}
      {!collapsed ? (
        <div className={styles.prompt}>
          <QuestionContentRenderer segments={prepared.content.prompt} />
        </div>
      ) : null}
    </article>
  );
}
