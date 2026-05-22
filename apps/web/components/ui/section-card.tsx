export function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={['lg-surface rounded-[28px] p-5', className].join(' ')}>
      {children}
    </div>
  );
}
