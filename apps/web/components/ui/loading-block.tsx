import { SectionCard } from './section-card';

export function LoadingBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <SectionCard>
      <div className="flex items-center gap-3" role="status" aria-live="polite">
        <span
          aria-hidden="true"
          className="h-7 w-7 shrink-0 animate-spin rounded-full border-[3px] border-[var(--accent)]/20 border-t-[var(--accent)]"
        />
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-sm text-[var(--muted)]">{description}</div>
        </div>
      </div>
    </SectionCard>
  );
}
