'use client';

import type { CatalogSortKey, CatalogTypeOption } from '@lean-poizon/shared';
import { CATALOG_TYPE_OPTIONS } from '@lean-poizon/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CatalogFilterDropdown } from '../../../components/ui/catalog-filter-dropdown';
import { CatalogGrid } from '../../../components/ui/catalog-grid';
import { CatalogHelpPopover } from '../../../components/ui/catalog-help-popover';
import { CatalogProductModal } from '../../../components/ui/catalog-product-modal';
import { PageSection } from '../../../components/ui/page-section';
import { catalogApi } from '../../../lib/api-client';
import { CATALOG_TYPE_LABELS_RU } from '../../../lib/catalog-type-labels';
import { extractAxiosMessage } from '../../../lib/error-utils';
import { hapticImpact } from '../../../lib/telegram-web-app';
import { useCatalogStore } from '../../../store/catalog-store';

const PAGE_LIMIT = 30;
const SEARCH_DEBOUNCE_MS = 500;

const TYPE_OPTIONS = CATALOG_TYPE_OPTIONS.map((type) => ({
  value: type,
  label: CATALOG_TYPE_LABELS_RU[type],
}));

const SORT_OPTIONS: Array<{ value: CatalogSortKey; label: string }> = [
  { value: 'price_asc', label: 'Сначала дешевле' },
  { value: 'price_desc', label: 'Сначала дороже' },
];

type OpenDropdown = 'category' | 'sort' | 'help' | null;

export default function CatalogPage() {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [quickViewSpuId, setQuickViewSpuId] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const selectedType = useCatalogStore((state) => state.selectedType);
  const sort = useCatalogStore((state) => state.sort);
  const searchText = useCatalogStore((state) => state.searchText);
  const debouncedQuery = useCatalogStore((state) => state.debouncedQuery);
  const items = useCatalogStore((state) => state.items);
  const page = useCatalogStore((state) => state.page);
  const hasMore = useCatalogStore((state) => state.hasMore);
  const error = useCatalogStore((state) => state.error);
  const isLoadingInitial = useCatalogStore((state) => state.isLoadingInitial);
  const isLoadingMore = useCatalogStore((state) => state.isLoadingMore);
  const hasFetchedOnce = useCatalogStore((state) => state.hasFetchedOnce);
  const scrollY = useCatalogStore((state) => state.scrollY);
  const setType = useCatalogStore((state) => state.setType);
  const setSort = useCatalogStore((state) => state.setSort);
  const setSearchText = useCatalogStore((state) => state.setSearchText);
  const commitSearchQuery = useCatalogStore((state) => state.commitSearchQuery);
  const startInitialLoad = useCatalogStore((state) => state.startInitialLoad);
  const startLoadMore = useCatalogStore((state) => state.startLoadMore);
  const setPageResult = useCatalogStore((state) => state.setPageResult);
  const setError = useCatalogStore((state) => state.setError);
  const setScrollY = useCatalogStore((state) => state.setScrollY);

  const hasFilters = Boolean(selectedType || debouncedQuery);

  const loadPage = useCallback(
    async (targetPage: number) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (targetPage === 1) startInitialLoad();
      else startLoadMore();

      try {
        const response = hasFilters
          ? await catalogApi.search({
              type: selectedType ?? undefined,
              q: debouncedQuery || undefined,
              sort,
              page: targetPage,
              limit: PAGE_LIMIT,
            })
          : await catalogApi.list({ page: targetPage, limit: PAGE_LIMIT, sort });
        setPageResult(response.items, targetPage, response.hasMore, targetPage > 1);
      } catch (requestError) {
        setError(
          extractAxiosMessage(requestError) ?? 'Не удалось загрузить каталог. Попробуйте ещё раз позже.',
        );
      } finally {
        isFetchingRef.current = false;
      }
    },
    [hasFilters, selectedType, debouncedQuery, sort, startInitialLoad, startLoadMore, setPageResult, setError],
  );

  // Debounce free-text typing into debouncedQuery (which drives the fetch)
  // — commitSearchQuery is a no-op if the value hasn't actually changed
  // (e.g. this firing again on remount with nothing new typed).
  useEffect(() => {
    const handle = setTimeout(() => commitSearchQuery(), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchText, commitSearchQuery]);

  // Fetch page 1 only if the current filter combo hasn't loaded yet —
  // returning to this tab with the same filters just re-renders what's
  // already in the store instead of re-fetching.
  useEffect(() => {
    if (!hasFetchedOnce) {
      void loadPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, sort, debouncedQuery]);

  // Restore scroll position when returning to an already-loaded feed; save
  // it on the way out (tab switch, or opening the quick-view modal).
  useEffect(() => {
    if (hasFetchedOnce && scrollY > 0) {
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    }
    return () => setScrollY(window.scrollY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    if (isFetchingRef.current || !hasMore) return;
    void loadPage(page + 1);
  }, [hasMore, page, loadPage]);

  const retry = useCallback(() => {
    void loadPage(page === 1 ? 1 : page);
  }, [loadPage, page]);

  const openProduct = useCallback((spuId: string) => {
    hapticImpact('light');
    setQuickViewSpuId(spuId);
  }, []);

  return (
    <PageSection className="lg:mx-auto lg:max-w-6xl">
      <input
        type="text"
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        placeholder="Поиск: например, nike"
        className="w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[var(--accent)]"
      />

      <div className="flex flex-wrap gap-2">
        <CatalogFilterDropdown
          idleLabel="Все категории"
          options={TYPE_OPTIONS}
          selectedValue={selectedType}
          onSelect={(value) => {
            setType(value as CatalogTypeOption | null);
            setOpenDropdown(null);
          }}
          isOpen={openDropdown === 'category'}
          onToggle={() => setOpenDropdown((prev) => (prev === 'category' ? null : 'category'))}
        />
        <CatalogFilterDropdown
          idleLabel="Популярное"
          options={SORT_OPTIONS}
          selectedValue={sort === 'best' ? null : sort}
          onSelect={(value) => {
            setSort((value as CatalogSortKey) ?? 'best');
            setOpenDropdown(null);
          }}
          isOpen={openDropdown === 'sort'}
          onToggle={() => setOpenDropdown((prev) => (prev === 'sort' ? null : 'sort'))}
        />
        <CatalogHelpPopover
          isOpen={openDropdown === 'help'}
          onToggle={() => setOpenDropdown((prev) => (prev === 'help' ? null : 'help'))}
        />
      </div>

      <CatalogGrid
        items={items}
        isLoadingInitial={isLoadingInitial}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        onLoadMore={loadMore}
        onRetry={retry}
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
            ? 'Попробуйте другой запрос или категорию.'
            : 'Каталог обновляется — загляните немного позже.'
        }
      />

      {quickViewSpuId ? (
        <CatalogProductModal spuId={quickViewSpuId} onClose={() => setQuickViewSpuId(null)} />
      ) : null}
    </PageSection>
  );
}
