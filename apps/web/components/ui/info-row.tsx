export function InfoRow({
  label,
  value,
  accent = false,
  stacked = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  /** Label above the value — for long values like an address. */
  stacked?: boolean;
}) {
  const valueClass = accent ? 'text-base font-extrabold text-[var(--accent)]' : 'font-bold text-white';
  if (stacked) {
    return (
      <div className="min-w-0 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm">
        <div className="font-medium text-[var(--muted)]">{label}</div>
        <div className={['mt-1 break-words leading-snug', valueClass].join(' ')}>{value}</div>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm">
      <span className="shrink-0 font-medium text-[var(--muted)]">{label}</span>
      <span className={['min-w-0 break-words text-right', valueClass].join(' ')}>{value}</span>
    </div>
  );
}
