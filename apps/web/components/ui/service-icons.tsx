/**
 * Custom "emoji" for delivery extras and the partner's pickup points: a
 * tinted rounded tile with an own glyph, sized like the carrier logos so a
 * row of options lines up.
 */
export type ServiceIconKind = 'insurance' | 'box' | 'crate' | 'photo' | 'photo-detailed' | 'partner-point' | 'courier';

const TILES: Record<ServiceIconKind, { bg: string; fg: string }> = {
  insurance: { bg: 'bg-emerald-400/15', fg: 'text-emerald-300' },
  box: { bg: 'bg-amber-400/15', fg: 'text-amber-300' },
  crate: { bg: 'bg-orange-400/15', fg: 'text-orange-300' },
  photo: { bg: 'bg-sky-400/15', fg: 'text-sky-300' },
  'photo-detailed': { bg: 'bg-violet-400/15', fg: 'text-violet-300' },
  'partner-point': { bg: 'bg-teal-400/15', fg: 'text-teal-300' },
  courier: { bg: 'bg-rose-400/15', fg: 'text-rose-300' },
};

function Glyph({ kind }: { kind: ServiceIconKind }) {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-[62%] w-[62%]',
  };
  switch (kind) {
    case 'insurance':
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />
          <path d="M8.8 12.2l2.2 2.2 4.3-4.6" />
        </svg>
      );
    case 'box':
      return (
        <svg {...common}>
          <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z" />
          <path d="M3.5 7.5L12 12l8.5-4.5" />
          <path d="M12 12v9" />
          <path d="M7.8 5.2l8.5 4.6v3.4" />
        </svg>
      );
    case 'crate':
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
          <path d="M3.5 9.5h17M3.5 14.5h17" />
          <path d="M8 4.5v15M16 4.5v15" />
          <path d="M8 9.5l8 5" />
        </svg>
      );
    case 'photo':
      return (
        <svg {...common}>
          <path d="M4 8.5A1.5 1.5 0 015.5 7h2l1.4-2h6.2L16.5 7h2A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5v-9z" />
          <circle cx="12" cy="13" r="3.4" />
        </svg>
      );
    case 'photo-detailed':
      return (
        <svg {...common}>
          <path d="M13 19H5.5A1.5 1.5 0 014 17.5v-9A1.5 1.5 0 015.5 7h2l1.4-2h6.2L16.5 7h2A1.5 1.5 0 0120 8.5V11" />
          <circle cx="11" cy="12.5" r="3" />
          <circle cx="17.5" cy="16.5" r="2.5" />
          <path d="M19.4 18.4l1.6 1.6" />
        </svg>
      );
    case 'partner-point':
      return (
        <svg {...common}>
          <path d="M4 10l1.5-5h13L20 10" />
          <path d="M4 10a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0" />
          <path d="M5.5 12.5V20h13v-7.5" />
          <path d="M10 20v-4.5h4V20" />
        </svg>
      );
    case 'courier':
      return (
        <svg {...common}>
          <path d="M3 6.5h10v9H3z" />
          <path d="M13 9.5h4l3 3v3h-7" />
          <circle cx="7" cy="17.5" r="1.8" />
          <circle cx="16.5" cy="17.5" r="1.8" />
        </svg>
      );
  }
}

export function ServiceIcon({ kind, className = 'h-9 w-9' }: { kind: ServiceIconKind; className?: string }) {
  const tile = TILES[kind];
  return (
    <span
      aria-hidden
      className={`${className} ${tile.bg} ${tile.fg} inline-flex shrink-0 items-center justify-center rounded-[28%]`}
    >
      <Glyph kind={kind} />
    </span>
  );
}
