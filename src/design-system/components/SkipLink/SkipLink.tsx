import styles from './SkipLink.module.css';

export function SkipLink() {
  return (
    <a className={styles.link} href="#main-content">
      Aller au contenu principal
    </a>
  );
}
