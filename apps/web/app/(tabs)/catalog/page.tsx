'use client';

import type { CatalogTypeOption } from '@lean-poizon/shared';
import { CATALOG_BRAND_OPTIONS, CATALOG_TYPE_OPTIONS } from '@lean-poizon/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { CatalogFilterDropdown } from '../../../components/ui/catalog-filter-dropdown';
import { CatalogGrid } from '../../../components/ui/catalog-grid';
import { PageSection } from '../../../components/ui/page-section';
import { catalogApi } from '../../../lib/api-client';
import { CATALOG_TYPE_LABELS_RU } from '../../../lib/catalog-type-labels';
import { hapticImpact } from '../../../lib/telegram-web-app';
import { useCatalogFeed } from '../../../lib/use-catalog-feed';

const PAGE_LIMIT = 30;

const TYPE_OPTIONS = CATALOG_TYPE_OPTIONS.map((type) => ({
  value: type,
  label: CATALOG_TYPE_LABELS_RU[type],
}));
const BRAND_OPTIONS = CATALOG_BRAND_OPTIONS.map((brand) => ({ value: brand, label: brand }));

type OpenDropdown = 'category' | 'brand' | null;

export default function CatalogPage() {
  const router = useRouter();
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [selectedType, setSelectedType] = useState<CatalogTypeOption | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const hasFilters = Boolean(selectedType || selectedBrand);

  // One unified feed: plain "Популярное" when no filter is active, filtered
  // search results otherwise. useCatalogFeed resets to page 1 automatically
  // whenever this fetcher's identity changes (i.e. a filter changed).
  const fetchPage = useCallback(
    (page: number) =>
      hasFilters
        ? catalogApi.search({
            brand: selectedBrand ?? undefined,
            type: selectedType ?? undefined,
            page,
            limit: PAGE_LIMIT,
          })
        : catalogApi.list({ page, limit: PAGE_LIMIT }),
    [hasFilters, selectedBrand, selectedType],
  );
  const feed = useCatalogFeed(fetchPage);

  const openProduct = useCallback(
    (spuId: string) => {
      hapticImpact('light');
      router.push(`/calculator?spuId=${encodeURIComponent(spuId)}`);
    },
    [router],
  );

  return (
    <PageSection className="lg:mx-auto lg:max-w-6xl">
      <div className="flex flex-wrap gap-2">
        <CatalogFilterDropdown
          idleLabel="Все категории"
          options={TYPE_OPTIONS}
          selectedValue={selectedType}
          onSelect={(value) => {
            setSelectedType(value as CatalogTypeOption | null);
            setOpenDropdown(null);
          }}
          isOpen={openDropdown === 'category'}
          onToggle={() => setOpenDropdown((prev) => (prev === 'category' ? null : 'category'))}
        />
        <CatalogFilterDropdown
          idleLabel="Все бренды"
          options={BRAND_OPTIONS}
          selectedValue={selectedBrand}
          onSelect={(value) => {
            setSelectedBrand(value);
            setOpenDropdown(null);
          }}
          isOpen={openDropdown === 'brand'}
          onToggle={() => setOpenDropdown((prev) => (prev === 'brand' ? null : 'brand'))}
        />
      </div>

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
            ? 'Попробуйте другой бренд или категорию.'
            : 'Каталог обновляется — загляните немного позже.'
        }
      />
    </PageSection>
  );
}
