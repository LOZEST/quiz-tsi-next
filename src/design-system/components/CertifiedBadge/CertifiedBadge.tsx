import styles from './CertifiedBadge.module.css';

export function CertifiedBadge() {
  return (
    <span
      className={styles.badge}
      title="Ce Quizz a été certifié par un administrateur"
    >
      Quizz certifié
    </span>
  );
}
