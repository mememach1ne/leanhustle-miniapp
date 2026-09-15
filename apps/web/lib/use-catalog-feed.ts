import type { CatalogListResponse, CatalogProductDto } from '@lean-poizon/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { extractAxiosMessage } from './error-utils';

/**
 * Shared pagination/infinite-scroll state machine for a catalog feed
 * ("Популярное" or filters/search results). `fetchPage` is called with the
 * target page number; whenever the *fetcher itself* changes identity (e.g.
 * the user picks a different brand/type/query), the hook resets to page 1
 * and refetches automatically.
 */
export function useCatalogFeed(fetchPage: (page: number) => Promise<CatalogListResponse>) {
  const [items, setItems] = useState<CatalogProductDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef(false);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const load = useCallback(async (targetPage: number) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setError(null);

    try {
      const response = await fetchPageRef.current(targetPage);
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

  // Reset + reload page 1 whenever the fetcher identity changes (filters
  // changed) — including on mount.
  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setIsLoadingInitial(true);
    void load(1);
    // `load` is stable (empty deps); `fetchPage` identity is what should
    // actually trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (isFetchingRef.current || !hasMore) return;
    setIsLoadingMore(true);
    void load(page + 1);
  }, [hasMore, page, load]);

  const retry = useCallback(() => {
    void load(page === 1 ? 1 : page);
  }, [load, page]);

  return { items, isLoadingInitial, isLoadingMore, hasMore, error, loadMore, retry };
}
