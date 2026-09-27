export function SectionCard({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={['lg-surface rounded-[24px] p-4', className].join(' ')} style={style}>
      {children}
    </div>
  );
}
