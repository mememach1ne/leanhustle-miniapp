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
    <div
      className={[
        'flex min-w-0 items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm',
        accent ? 'bg-[var(--accent)]/12' : 'bg-white/5',
      ].join(' ')}
    >
      <span className="min-w-0 text-[var(--muted)]">{label}</span>
      <span className="shrink-0 text-right font-medium text-white">{value}</span>
    </div>
  );
}
