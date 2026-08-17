import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        <h1>{title}</h1>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {description ? <p>{description}</p> : null}
    </header>
  );
}
