export function PageSection({
  children,
  hasStickyFooter = false,
}: {
  children: React.ReactNode;
  hasStickyFooter?: boolean;
}) {
  return (
    <section className={['space-y-4', hasStickyFooter ? 'pb-32' : 'pb-2'].join(' ')}>
      {children}
    </section>
  );
}
