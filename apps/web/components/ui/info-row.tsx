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
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm">
      <span className="min-w-0 font-medium text-[var(--muted)]">{label}</span>
      <span
        className={[
          'shrink-0 text-right',
          accent ? 'text-base font-extrabold text-[var(--accent)]' : 'font-bold text-white',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
