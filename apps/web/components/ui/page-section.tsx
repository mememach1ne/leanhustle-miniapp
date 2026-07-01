export function PageSection({
  children,
  hasStickyFooter = false,
  className = '',
}: {
  children: React.ReactNode;
  hasStickyFooter?: boolean;
  /** Extra classes, e.g. a desktop width constraint like `lg:max-w-2xl lg:mx-auto`. */
  className?: string;
}) {
  return (
    <section
      className={[
        'space-y-4',
        hasStickyFooter ? 'pb-32 lg:pb-2' : 'pb-2',
        className,
      ].join(' ')}
    >
      {children}
    </section>
  );
}
