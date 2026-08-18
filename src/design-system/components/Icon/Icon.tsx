import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 24 24',
  width: '1.2em',
  height: '1.2em',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

export function IconWhiteboard(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20.5h7M12 16.5v4" />
      <path d="M7 9.5l3 3 2.5-2.5L17 13.5" />
    </svg>
  );
}

export function IconProgress(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19V10M10 19V5M16 19v-7M20 19V8" />
    </svg>
  );
}

export function IconBank(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M5 10.5V19M19 10.5V19M9.5 10.5V19M14.5 10.5V19" />
      <path d="M3.5 19h17" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.4l1.55 1.55M17.55 16.05l1.55 1.55M3.5 12h2.2M18.3 12h2.2M4.9 17.6l1.55-1.55M17.55 7.95l1.55-1.55" />
    </svg>
  );
}

export function IconAccount(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8.2" r="3.4" />
      <path d="M4.8 19.5c1.3-3.2 4-4.8 7.2-4.8s5.9 1.6 7.2 4.8" />
    </svg>
  );
}

export function IconAdmin(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 5 6.3v5.4c0 4.4 2.9 7.6 7 8.8 4.1-1.2 7-4.4 7-8.8V6.3L12 3.5Z" />
      <path d="M9.2 12.1l2 2 3.6-4" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconFilter(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h16L14 13v6l-4 2v-8L4 5Z" />
    </svg>
  );
}
