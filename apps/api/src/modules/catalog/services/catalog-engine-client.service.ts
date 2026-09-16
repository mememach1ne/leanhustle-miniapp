import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { getDewuEngineCredentials } from '../../../common/dewu-engine.config';

export type CatalogSortKey = 'best' | 'price_asc' | 'price_desc';

export interface CatalogEngineItem {
  spuId: string;
  title: string;
  article?: string;
  image: string;
  priceCny: number | null;
  priceFen?: number | null;
  soldText?: string;
  /** Only present on /search results — the engine's own pre-parsed sales count (e.g. 2590000 for "259w+"). */
  soldRank?: number;
}

interface CatalogEngineSlice {
  query?: string;
  sort?: string;
  sortedByBest?: boolean;
  pageNum: number;
  pageSize: number;
  total: number;
  pages: number;
  items: CatalogEngineItem[];
}

interface CatalogEngineEnvelope<T> {
  code: number;
  msg: string;
  data?: T;
}

/**
 * Talks to the self-hosted price engine's catalog endpoints (see
 * docs/SHOP_MVP_PLAN.md §1, §"Фильтры и поиск (v2)" and §v3). Same engine
 * as DewuApiClientService, different routes — only CatalogSyncService
 * calls this on a schedule; the storefront itself reads from our own DB
 * (CatalogProduct), never the engine directly (except the live-search
 * fallback for out-of-snapshot free-text queries).
 */
@Injectable()
export class CatalogEngineClientService {
  private readonly logger = new Logger(CatalogEngineClientService.name);

  /** GET /catalog?page= — the "Популярное" feed. [] once the engine has nothing more. */
  async fetchPage(page: number): Promise<CatalogEngineItem[]> {
    const data = await this.fetchJson<CatalogEngineSlice>(`/catalog?page=${page}`, `page=${page}`);
    return data?.items ?? [];
  }

  /** GET /search?q=&sort= — Best Sellers (or another single sort) for a keyword. */
  async search(keyword: string, sort: CatalogSortKey = 'best'): Promise<CatalogEngineItem[]> {
    const data = await this.fetchJson<CatalogEngineSlice>(
      `/search?q=${encodeURIComponent(keyword)}&sort=${sort}`,
      `q="${keyword}" sort=${sort}`,
    );
    return data?.items ?? [];
  }

  /**
   * GET /search/multi?q=&sorts=a,b — every requested sort in one engine
   * navigation (one stealth page-load instead of one per sort — see plan
   * §v3, ~11-16s for the first sort + ~4-5s per extra sort vs a full
   * ~11-16s repeat). Returns one item array per requested sort key.
   */
  async searchMulti(
    keyword: string,
    sorts: CatalogSortKey[],
  ): Promise<Record<CatalogSortKey, CatalogEngineItem[]>> {
    const sortsParam = sorts.join(',');
    const data = await this.fetchJson<Record<string, CatalogEngineSlice>>(
      `/search/multi?q=${encodeURIComponent(keyword)}&sorts=${encodeURIComponent(sortsParam)}`,
      `q="${keyword}" sorts=${sortsParam}`,
    );
    const result = {} as Record<CatalogSortKey, CatalogEngineItem[]>;
    for (const sortKey of sorts) {
      result[sortKey] = data?.[sortKey]?.items ?? [];
    }
    return result;
  }

  private async fetchJson<T>(path: string, logContext: string): Promise<T | undefined> {
    const { engineUrl, engineToken } = getDewuEngineCredentials();
    const url = `${engineUrl}${path}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'x-api-token': engineToken },
      });

      if (!response.ok) {
        this.logger.warn(`Catalog engine HTTP ${response.status} for ${logContext}`);
        throw new ServiceUnavailableException('Не удалось получить каталог.');
      }

      const body = (await response.json()) as CatalogEngineEnvelope<T>;

      if (body.code !== 200) {
        this.logger.warn(
          `Catalog engine returned code=${body.code} msg="${body.msg}" for ${logContext}`,
        );
        throw new ServiceUnavailableException('Каталог временно недоступен.');
      }

      return body.data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn('Catalog engine request failed', {
        logContext,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableException('Каталог временно недоступен.');
    }
  }
}
