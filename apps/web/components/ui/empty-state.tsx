import { SectionCard } from './section-card';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <SectionCard className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/6 text-xl">
        •
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </SectionCard>
  );
}
