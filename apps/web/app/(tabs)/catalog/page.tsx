'use client';

import type { CatalogTypeOption } from '@lean-poizon/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { CatalogFilters } from '../../../components/ui/catalog-filters';
import { CatalogGrid } from '../../../components/ui/catalog-grid';
import { EmptyState } from '../../../components/ui/empty-state';
import { PageSection } from '../../../components/ui/page-section';
import { catalogApi } from '../../../lib/api-client';
import { hapticImpact, hapticSelection } from '../../../lib/telegram-web-app';
import { useCatalogFeed } from '../../../lib/use-catalog-feed';

const PAGE_LIMIT = 30;
const SEARCH_DEBOUNCE_MS = 500;

type CatalogTab = 'popular' | 'search';

export default function CatalogPage() {
  const router = useRouter();
  const [tab, setTab] = useState<CatalogTab>('popular');

  const openProduct = useCallback(
    (spuId: string) => {
      hapticImpact('light');
      router.push(`/calculator?spuId=${encodeURIComponent(spuId)}`);
    },
    [router],
  );

  // ─── "Популярное" ───────────────────────────────────────────
  const popularFetch = useCallback(
    (page: number) => catalogApi.list({ page, limit: PAGE_LIMIT }),
    [],
  );
  const popular = useCatalogFeed(popularFetch);

  // ─── "Поиск" (фильтры) ──────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedType, setSelectedType] = useState<CatalogTypeOption | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const hasSearchCriteria = Boolean(selectedType || selectedBrand || debouncedQuery);

  const searchFetch = useCallback(
    (page: number) =>
      catalogApi.search({
        brand: selectedBrand ?? undefined,
        type: selectedType ?? undefined,
        q: debouncedQuery || undefined,
        page,
        limit: PAGE_LIMIT,
      }),
    [selectedBrand, selectedType, debouncedQuery],
  );
  const search = useCatalogFeed(searchFetch);

  return (
    <PageSection className="lg:mx-auto lg:max-w-6xl">
      {/* Tab switcher */}
      <div className="flex gap-2 rounded-[18px] border border-white/10 bg-white/5 p-1">
        {(
          [
            ['popular', 'Популярное'],
            ['search', 'Поиск'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              hapticSelection();
              setTab(key);
            }}
            className={[
              'flex-1 rounded-[14px] px-3 py-2 text-sm font-semibold transition',
              tab === key ? 'bg-[var(--accent)] text-slate-950' : 'text-white',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'popular' ? (
        <CatalogGrid
          items={popular.items}
          isLoadingInitial={popular.isLoadingInitial}
          isLoadingMore={popular.isLoadingMore}
          hasMore={popular.hasMore}
          error={popular.error}
          onLoadMore={popular.loadMore}
          onRetry={popular.retry}
          onItemClick={openProduct}
          loadingTitle="Загружаем магазин"
          loadingDescription="Собираем самые популярные товары Poizon."
          emptyTitle="Магазин пока пуст"
          emptyDescription="Каталог обновляется — загляните немного позже."
        />
      ) : (
        <>
          <CatalogFilters
            searchText={searchInput}
            onSearchTextChange={setSearchInput}
            selectedType={selectedType}
            onSelectType={setSelectedType}
            selectedBrand={selectedBrand}
            onSelectBrand={setSelectedBrand}
          />

          {hasSearchCriteria ? (
            <CatalogGrid
              items={search.items}
              isLoadingInitial={search.isLoadingInitial}
              isLoadingMore={search.isLoadingMore}
              hasMore={search.hasMore}
              error={search.error}
              onLoadMore={search.loadMore}
              onRetry={search.retry}
              onItemClick={openProduct}
              loadingTitle="Ищем товары"
              loadingDescription="Может занять до 20 секунд для нового запроса."
              emptyTitle="Ничего не найдено"
              emptyDescription="Попробуйте другой бренд, тип или запрос."
            />
          ) : (
            <EmptyState
              title="Выберите фильтр"
              description="Отметьте бренд, тип или введите запрос, чтобы найти товары."
            />
          )}
        </>
      )}
    </PageSection>
  );
}
