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
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-2xl bg-[var(--accent)]/20" />
        <div className="space-y-2">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-sm text-[var(--muted)]">{description}</div>
        </div>
      </div>
    </SectionCard>
  );
}
