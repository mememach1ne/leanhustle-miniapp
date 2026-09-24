import { SectionCard } from './section-card';

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <SectionCard className="text-center">
      {icon ? (
        <div
          aria-hidden="true"
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/6 text-2xl leading-none"
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </SectionCard>
  );
}
