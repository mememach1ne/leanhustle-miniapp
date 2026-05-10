export function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        'rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[0_20px_60px_rgba(2,8,20,0.22)] backdrop-blur-xl',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
