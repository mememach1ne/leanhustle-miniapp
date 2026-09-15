import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { getDewuEngineCredentials } from '../../../common/dewu-engine.config';

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

interface CatalogEngineResponse {
  code: number;
  msg: string;
  data?: {
    query?: string;
    sortedByBest?: boolean;
    pageNum: number;
    pageSize: number;
    total: number;
    pages: number;
    items: CatalogEngineItem[];
  };
}

/**
 * Talks to the self-hosted price engine's catalog endpoints (see
 * docs/SHOP_MVP_PLAN.md §1 and §"Фильтры и поиск (v2)"). Same engine as
 * DewuApiClientService, different routes — only CatalogSyncService calls
 * this on a schedule; the storefront itself reads from our own DB
 * (CatalogProduct), never the engine directly (except the live-search
 * fallback for out-of-snapshot free-text queries).
 */
@Injectable()
export class CatalogEngineClientService {
  private readonly logger = new Logger(CatalogEngineClientService.name);

  /** GET /catalog?page= — the "Популярное" feed. [] once the engine has nothing more. */
  async fetchPage(page: number): Promise<CatalogEngineItem[]> {
    return this.fetchItems(`/catalog?page=${page}`, `page=${page}`);
  }

  /** GET /search?q= — Best Sellers for a brand/type/free-text keyword. */
  async search(keyword: string): Promise<CatalogEngineItem[]> {
    return this.fetchItems(`/search?q=${encodeURIComponent(keyword)}`, `q="${keyword}"`);
  }

  private async fetchItems(path: string, logContext: string): Promise<CatalogEngineItem[]> {
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

      const body = (await response.json()) as CatalogEngineResponse;

      if (body.code !== 200) {
        this.logger.warn(
          `Catalog engine returned code=${body.code} msg="${body.msg}" for ${logContext}`,
        );
        throw new ServiceUnavailableException('Каталог временно недоступен.');
      }

      return body.data?.items ?? [];
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
