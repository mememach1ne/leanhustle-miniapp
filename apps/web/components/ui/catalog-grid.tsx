'use client';

import type { CatalogProductDto } from '@lean-poizon/shared';
import { useEffect, useRef } from 'react';

import { CatalogCard } from './catalog-card';
import { EmptyState } from './empty-state';
import { FeedbackMessage } from './feedback-message';
import { LoadingBlock } from './loading-block';

export function CatalogGrid({
  items,
  isLoadingInitial,
  isLoadingMore,
  hasMore,
  error,
  onLoadMore,
  onRetry,
  onItemClick,
  loadingTitle,
  loadingDescription,
  emptyTitle,
  emptyDescription,
}: {
  items: CatalogProductDto[];
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
  onItemClick: (spuId: string) => void;
  loadingTitle: string;
  loadingDescription: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Infinite scroll: fetch the next page once the sentinel enters view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoadingInitial) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingInitial, onLoadMore]);

  if (isLoadingInitial) {
    return <LoadingBlock title={loadingTitle} description={loadingDescription} />;
  }

  if (error && items.length === 0) {
    return (
      <FeedbackMessage tone="error" onRetry={onRetry}>
        {error}
      </FeedbackMessage>
    );
  }

  if (items.length === 0) {
    return <EmptyState icon="🔍" title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((product) => (
          <CatalogCard
            key={product.spuId}
            product={product}
            onClick={() => onItemClick(product.spuId)}
          />
        ))}
      </div>

      {error ? (
        <FeedbackMessage tone="error" onRetry={onRetry}>
          {error}
        </FeedbackMessage>
      ) : null}

      {hasMore ? (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {isLoadingMore ? (
            <span className="text-xs text-[var(--muted)]">Загружаем ещё…</span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
