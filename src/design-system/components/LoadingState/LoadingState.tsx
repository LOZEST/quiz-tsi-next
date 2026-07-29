import styles from './LoadingState.module.css';

export function LoadingState({
  message = 'Chargement…',
}: {
  message?: string;
}) {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <span className={styles.indicator} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
