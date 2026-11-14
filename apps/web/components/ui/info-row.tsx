export function InfoRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm">
      <span className="shrink-0 font-medium leading-snug text-[var(--muted)]">{label}</span>
      {/* Long values (an address) wrap on the right instead of overflowing. */}
      <span
        className={[
          'min-w-0 break-words text-right leading-snug',
          accent ? 'text-base font-extrabold text-[var(--accent)]' : 'font-bold text-white',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
