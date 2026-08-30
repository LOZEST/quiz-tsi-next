import { useId, useState, type ReactNode } from 'react';
import styles from './Disclosure.module.css';

interface DisclosureProps {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function Disclosure({
  label,
  children,
  defaultOpen = false,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div>
      <button
        className={styles.trigger}
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{label}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div id={contentId} hidden={!open} className={styles.content}>
        {children}
      </div>
    </div>
  );
}
