import { Button } from '@design-system/components/Button/Button';
import styles from './ErrorState.module.css';

interface ErrorStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorState({
  title = 'Une erreur est survenue',
  message,
  actionLabel,
  onAction,
}: ErrorStateProps) {
  return (
    <section className={styles.state} role="alert">
      <h1>{title}</h1>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <Button onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </section>
  );
}
