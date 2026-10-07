// Every icon in the app, as inline SVG (no icon fonts, no CDN).
// One file so the stroke width and size are consistent everywhere, and so a
// glyph like the close "x" isn't copy-pasted into four components. All are
// decorative (aria-hidden); the button or text next to them carries the name.

type IconProps = { size?: number; className?: string };

function Svg({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </Svg>
  );
}

/** A speech bubble, for the plain-English QueryBox. */
export function IconChat(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-8l-4 3.5V16H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
      <path d="M8.5 10.5h7M8.5 13h4" />
    </Svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

/** Gain/loss direction for change chips: an arrow up and to the right, or down and to the right. */
export function IconTrend({ direction, ...props }: IconProps & { direction: "up" | "down" }) {
  return (
    <Svg {...props}>
      {direction === "up" ? <path d="M7 17L17 7M9 7h8v8" /> : <path d="M7 7l10 10M17 9v8H9" />}
    </Svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </Svg>
  );
}

export function IconWarning(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4l9 16H3L12 4z" />
      <path d="M12 10v4M12 17h.01" />
    </Svg>
  );
}

export function IconStar({ filled, ...props }: IconProps & { filled: boolean }) {
  return (
    <Svg {...props}>
      <path
        d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z"
        fill={filled ? "currentColor" : "none"}
      />
    </Svg>
  );
}

export function IconChevron({ direction, ...props }: IconProps & { direction: "left" | "right" }) {
  return (
    <Svg {...props}>
      <path d={direction === "left" ? "M14.5 6l-6 6 6 6" : "M9.5 6l6 6-6 6"} />
    </Svg>
  );
}

/** Sort state for a table header: one arrow when sorted, a faint up/down pair when not. */
export function IconSort({ direction, ...props }: IconProps & { direction: "asc" | "desc" | null }) {
  if (direction === "asc") {
    return (
      <Svg {...props}>
        <path d="M12 19V5M6.5 10.5L12 5l5.5 5.5" />
      </Svg>
    );
  }
  if (direction === "desc") {
    return (
      <Svg {...props}>
        <path d="M12 5v14M6.5 13.5L12 19l5.5-5.5" />
      </Svg>
    );
  }
  return (
    <Svg {...props}>
      <path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4" />
    </Svg>
  );
}

export function IconFilter(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </Svg>
  );
}

/** Offline demo mode: a signal arc with a slash through it. */
export function IconOffline(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 10.5a10 10 0 0114 0M8 13.5a5.5 5.5 0 018 0M12 17h.01M4 4l16 16" />
    </Svg>
  );
}

/** Empty results: an open tray. */
export function IconTray(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 13l2.5-7h11L20 13v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z" />
      <path d="M4 13h4.5l1 2h5l1-2H20" />
    </Svg>
  );
}

/** The StockPilot mark: a rising line on a deep teal tile with a soft top highlight. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="logo-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-accent-600)" />
          <stop offset="1" stopColor="var(--color-accent-800)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-fill)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="white" strokeOpacity="0.18" />
      <path
        d="M8 21l5-5 4 3.5 7-8"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="11.5" r="1.9" fill="var(--color-accent-200)" />
    </svg>
  );
}
