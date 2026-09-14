'use client';

import type { CatalogProductDto } from '@lean-poizon/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CatalogCard } from '../../../components/ui/catalog-card';
import { EmptyState } from '../../../components/ui/empty-state';
import { FeedbackMessage } from '../../../components/ui/feedback-message';
import { LoadingBlock } from '../../../components/ui/loading-block';
import { PageSection } from '../../../components/ui/page-section';
import { catalogApi } from '../../../lib/api-client';
import { extractAxiosMessage } from '../../../lib/error-utils';
import { hapticImpact } from '../../../lib/telegram-web-app';

const PAGE_LIMIT = 30;

export default function CatalogPage() {
  const router = useRouter();

  const [items, setItems] = useState<CatalogProductDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);

  const loadPage = useCallback(async (targetPage: number) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setError(null);

    try {
      const response = await catalogApi.list({ page: targetPage, limit: PAGE_LIMIT });
      setItems((prev) => (targetPage === 1 ? response.items : [...prev, ...response.items]));
      setHasMore(response.hasMore);
      setPage(targetPage);
    } catch (requestError) {
      setError(
        extractAxiosMessage(requestError) ??
          'Не удалось загрузить каталог. Попробуйте ещё раз позже.',
      );
    } finally {
      isFetchingRef.current = false;
      setIsLoadingInitial(false);
      setIsLoadingMore(false);
    }
  }, []);

  // Initial load.
  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  // Infinite scroll: fetch the next page once the sentinel enters view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoadingInitial) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingRef.current) {
          setIsLoadingMore(true);
          void loadPage(page + 1);
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingInitial, page, loadPage]);

  const openProduct = (spuId: string) => {
    hapticImpact('light');
    router.push(`/calculator?spuId=${encodeURIComponent(spuId)}`);
  };

  return (
    <PageSection className="lg:mx-auto lg:max-w-6xl">
      {isLoadingInitial ? (
        <LoadingBlock
          title="Загружаем магазин"
          description="Собираем самые популярные товары Poizon."
        />
      ) : error && items.length === 0 ? (
        <FeedbackMessage tone="error" onRetry={() => void loadPage(1)}>
          {error}
        </FeedbackMessage>
      ) : items.length === 0 ? (
        <EmptyState
          title="Магазин пока пуст"
          description="Каталог обновляется — загляните немного позже."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((product) => (
              <CatalogCard
                key={product.spuId}
                product={product}
                onClick={() => openProduct(product.spuId)}
              />
            ))}
          </div>

          {error ? (
            <FeedbackMessage tone="error" onRetry={() => void loadPage(page + 1)}>
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
      )}
    </PageSection>
  );
}
