import { useRef, useState } from 'react';
import { useAppServices } from '@app/providers/AppServicesProvider';
import type { PreparedQuestion } from '@domain/questions/PreparedQuestion';
import {
  questionClassification,
  type Question,
} from '@domain/questions/Question';
import { QuestionContentRenderer } from './QuestionContentRenderer';
import { ReportQuestionDialog } from './ReportQuestionDialog';
import { ReflexTimer } from '@features/session/ReflexTimer';
import { IconButton } from '@design-system/components/IconButton/IconButton';
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
  const [reportOpen, setReportOpen] = useState(false);
  const reportTriggerRef = useRef<HTMLButtonElement>(null);
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
        <div className={styles.actions}>
          <IconButton
            ref={reportTriggerRef}
            type="button"
            label="Signaler un problème sur cette question"
            onClick={() => setReportOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M5 21V4h13l-3 4 3 4H5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={
              collapsed ? 'Afficher la question' : 'Réduire la question'
            }
            className={styles.collapseButton}
            onClick={() => setCollapsed((value) => !value)}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              data-collapsed={collapsed}
            >
              <path d="m7 14 5-5 5 5" />
            </svg>
          </button>
        </div>
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
      <ReportQuestionDialog
        open={reportOpen}
        triggerRef={reportTriggerRef}
        questionId={prepared.questionId}
        questionVersion={prepared.questionVersion}
        onClose={() => setReportOpen(false)}
      />
    </article>
  );
}
