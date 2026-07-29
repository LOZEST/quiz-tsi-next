import type { ReactNode } from 'react';
import styles from './Surface.module.css';

export function Surface({ children }: { children: ReactNode }) {
  return <section className={styles.surface}>{children}</section>;
}
