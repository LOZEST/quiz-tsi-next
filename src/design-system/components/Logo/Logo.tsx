import styles from './Logo.module.css';

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  tagline?: string;
}

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={styles.mark}
      role="img"
      aria-label="Prépa Math"
    >
      <rect width="40" height="40" rx="10" fill="#0a66d8" />
      <path
        d="M11 13.5h18M11 13.5 20 26M29 13.5 20 26"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="20" cy="26" r="2.1" fill="white" />
    </svg>
  );
}

export function Logo({ size = 34, withWordmark = true, tagline }: LogoProps) {
  return (
    <span className={styles.lockup}>
      <LogoMark size={size} />
      {withWordmark ? (
        <span>
          <span className={styles.wordmark}>Prépa Math</span>
          {tagline ? <span className={styles.tagline}>{tagline}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
