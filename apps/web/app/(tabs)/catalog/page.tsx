'use client';

import type { CatalogTypeOption } from '@lean-poizon/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { CatalogFilterSheet } from '../../../components/ui/catalog-filter-sheet';
import { CatalogGrid } from '../../../components/ui/catalog-grid';
import { ChevronDownIcon } from '../../../components/ui/icons';
import { PageSection } from '../../../components/ui/page-section';
import { catalogApi } from '../../../lib/api-client';
import { CATALOG_TYPE_LABELS_RU } from '../../../lib/catalog-type-labels';
import { hapticImpact, hapticSelection } from '../../../lib/telegram-web-app';
import { useCatalogFeed } from '../../../lib/use-catalog-feed';

const PAGE_LIMIT = 30;
const SEARCH_DEBOUNCE_MS = 500;

export default function CatalogPage() {
  const router = useRouter();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedType, setSelectedType] = useState<CatalogTypeOption | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const hasFilters = Boolean(selectedType || selectedBrand || debouncedQuery);

  // One unified feed: plain "Популярное" when no filter is active, filtered
  // search results otherwise. useCatalogFeed resets to page 1 automatically
  // whenever this fetcher's identity changes (i.e. a filter changed).
  const fetchPage = useCallback(
    (page: number) =>
      hasFilters
        ? catalogApi.search({
            brand: selectedBrand ?? undefined,
            type: selectedType ?? undefined,
            q: debouncedQuery || undefined,
            page,
            limit: PAGE_LIMIT,
          })
        : catalogApi.list({ page, limit: PAGE_LIMIT }),
    [hasFilters, selectedBrand, selectedType, debouncedQuery],
  );
  const feed = useCatalogFeed(fetchPage);

  const openProduct = useCallback(
    (spuId: string) => {
      hapticImpact('light');
      router.push(`/calculator?spuId=${encodeURIComponent(spuId)}`);
    },
    [router],
  );

  const handleReset = () => {
    setSelectedType(null);
    setSelectedBrand(null);
    setSearchInput('');
    setDebouncedQuery('');
    setIsFilterOpen(false);
  };

  const filterLabel =
    selectedBrand && selectedType
      ? `${selectedBrand} · ${CATALOG_TYPE_LABELS_RU[selectedType]}`
      : (selectedBrand ??
        (selectedType ? CATALOG_TYPE_LABELS_RU[selectedType] : null) ??
        (debouncedQuery ? `«${debouncedQuery}»` : 'Популярные'));

  return (
    <PageSection className="lg:mx-auto lg:max-w-6xl">
      <button
        type="button"
        onClick={() => {
          hapticSelection();
          setIsFilterOpen(true);
        }}
        className="lg-chip flex w-fit items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-[var(--accent)] transition active:scale-95"
      >
        {filterLabel}
        <ChevronDownIcon className="h-4 w-4" />
      </button>

      <CatalogGrid
        items={feed.items}
        isLoadingInitial={feed.isLoadingInitial}
        isLoadingMore={feed.isLoadingMore}
        hasMore={feed.hasMore}
        error={feed.error}
        onLoadMore={feed.loadMore}
        onRetry={feed.retry}
        onItemClick={openProduct}
        loadingTitle={hasFilters ? 'Ищем товары' : 'Загружаем магазин'}
        loadingDescription={
          hasFilters
            ? 'Может занять до 20 секунд для нового запроса.'
            : 'Собираем самые популярные товары Poizon.'
        }
        emptyTitle={hasFilters ? 'Ничего не найдено' : 'Магазин пока пуст'}
        emptyDescription={
          hasFilters
            ? 'Попробуйте другой бренд, тип или запрос.'
            : 'Каталог обновляется — загляните немного позже.'
        }
      />

      {isFilterOpen ? (
        <CatalogFilterSheet
          searchText={searchInput}
          onSearchTextChange={setSearchInput}
          selectedType={selectedType}
          onSelectType={setSelectedType}
          selectedBrand={selectedBrand}
          onSelectBrand={setSelectedBrand}
          onClose={() => setIsFilterOpen(false)}
          onReset={handleReset}
        />
      ) : null}
    </PageSection>
  );
}
