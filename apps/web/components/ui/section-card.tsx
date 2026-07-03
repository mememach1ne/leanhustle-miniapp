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
    <div className={['lg-surface rounded-[28px] p-5', className].join(' ')} style={style}>
      {children}
    </div>
  );
}
