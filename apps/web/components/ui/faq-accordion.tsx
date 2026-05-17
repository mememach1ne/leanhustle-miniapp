import type { ReactNode } from 'react';

import { SectionCard } from './section-card';

export function FaqAccordion({
  items,
}: {
  items: Array<{ question: string; answer: ReactNode }>;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <SectionCard key={item.question}>
          <details className="group">
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
              {item.question}
              <span className="flex-shrink-0 text-[var(--muted)] transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.answer}</div>
          </details>
        </SectionCard>
      ))}
    </div>
  );
}
