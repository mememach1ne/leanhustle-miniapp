import type { CatalogProductDto, CatalogSortKey, CatalogTypeOption } from '@lean-poizon/shared';
import { create } from 'zustand';

/**
 * Persists the "Магазин" feed (filters + loaded items) across route changes.
 * The /catalog page unmounts whenever the user taps a bottom-nav tab or a
 * deep link, and a plain useState would lose the selected category, search
 * text, sort and the already-loaded grid on the way back. Living in a
 * module-level Zustand store (not component state) survives that
 * unmount/remount.
 */
interface CatalogStoreState {
  selectedType: CatalogTypeOption | null;
  sort: CatalogSortKey;
  /** Raw input value — reflects every keystroke immediately. */
  searchText: string;
  /** Debounced value that actually drives the fetch — see commitSearchQuery. */
  debouncedQuery: string;

  items: CatalogProductDto[];
  page: number;
  hasMore: boolean;
  error: string | null;
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  /** True once the current filter combo's page 1 has loaded — lets the page skip re-fetching on remount. */
  hasFetchedOnce: boolean;
  /** Scroll offset saved right before opening a product, restored on return. */
  scrollY: number;

  setType: (type: CatalogTypeOption | null) => void;
  setSort: (sort: CatalogSortKey) => void;
  setSearchText: (text: string) => void;
  /** Called (debounced) by the page once typing settles — commits searchText into debouncedQuery. */
  commitSearchQuery: () => void;
  startInitialLoad: () => void;
  startLoadMore: () => void;
  setPageResult: (items: CatalogProductDto[], page: number, hasMore: boolean, append: boolean) => void;
  setError: (error: string) => void;
  setScrollY: (value: number) => void;
}

const resetFeedFields = {
  items: [] as CatalogProductDto[],
  page: 1,
  hasMore: true,
  error: null as string | null,
  isLoadingInitial: true,
  isLoadingMore: false,
  hasFetchedOnce: false,
};

export const useCatalogStore = create<CatalogStoreState>((set, get) => ({
  selectedType: null,
  sort: 'best',
  searchText: '',
  debouncedQuery: '',
  scrollY: 0,
  ...resetFeedFields,

  setType: (selectedType) => set({ selectedType, ...resetFeedFields }),
  setSort: (sort) => set({ sort, ...resetFeedFields }),
  setSearchText: (searchText) => set({ searchText }),

  commitSearchQuery: () => {
    const trimmed = get().searchText.trim();
    if (trimmed === get().debouncedQuery) return;
    set({ debouncedQuery: trimmed, ...resetFeedFields });
  },

  startInitialLoad: () => set({ isLoadingInitial: true, error: null }),
  startLoadMore: () => set({ isLoadingMore: true, error: null }),

  setPageResult: (items, page, hasMore, append) =>
    set((state) => ({
      items: append ? [...state.items, ...items] : items,
      page,
      hasMore,
      isLoadingInitial: false,
      isLoadingMore: false,
      hasFetchedOnce: true,
      error: null,
    })),

  setError: (error) => set({ error, isLoadingInitial: false, isLoadingMore: false }),
  setScrollY: (scrollY) => set({ scrollY }),
}));
