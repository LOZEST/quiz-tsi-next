import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './IconButton.module.css';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={styles.button}
        aria-label={label}
        title={label}
        {...props}
      >
        <span aria-hidden="true">{children}</span>
      </button>
    );
  },
);
