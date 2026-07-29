import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  );
}
