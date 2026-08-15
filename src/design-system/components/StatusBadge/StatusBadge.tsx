import styles from './StatusBadge.module.css';

export type QuestionStatus = 'draft' | 'published' | 'archived';

const LABELS: Record<QuestionStatus, string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  archived: 'Archivée',
};

const TONE_CLASSNAMES: Record<QuestionStatus, string> = {
  draft: 'draft',
  published: 'published',
  archived: 'archived',
};

interface StatusBadgeProps {
  status: QuestionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[TONE_CLASSNAMES[status]]}`}>
      {LABELS[status]}
    </span>
  );
}
