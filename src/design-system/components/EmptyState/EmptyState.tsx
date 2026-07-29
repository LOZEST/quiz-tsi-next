import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <section className={styles.state}>
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}
