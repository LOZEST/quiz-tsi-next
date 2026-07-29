import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'quiet';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  busy?: boolean;
}

export function Button({
  variant = 'primary',
  busy = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {children}
    </button>
  );
}
