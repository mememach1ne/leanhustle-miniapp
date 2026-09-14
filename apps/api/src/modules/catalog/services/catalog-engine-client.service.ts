import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { getDewuEngineCredentials } from '../../../common/dewu-engine.config';

export interface CatalogEngineItem {
  spuId: string;
  title: string;
  article?: string;
  image: string;
  priceCny: number;
  priceFen?: number;
  soldText?: string;
}

interface CatalogEngineResponse {
  code: number;
  msg: string;
  data?: {
    pageNum: number;
    pageSize: number;
    total: number;
    pages: number;
    items: CatalogEngineItem[];
  };
}

/**
 * Talks to the self-hosted price engine's `GET /catalog?page=` endpoint (see
 * docs/SHOP_MVP_PLAN.md §1). Same engine as DewuApiClientService, different
 * route — only CatalogSyncService calls this; the storefront itself reads
 * from our own DB (CatalogProduct), never the engine directly.
 */
@Injectable()
export class CatalogEngineClientService {
  private readonly logger = new Logger(CatalogEngineClientService.name);

  /** Returns the page's items, or [] once the engine has nothing more. */
  async fetchPage(page: number): Promise<CatalogEngineItem[]> {
    const { engineUrl, engineToken } = getDewuEngineCredentials();
    const url = `${engineUrl}/catalog?page=${page}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'x-api-token': engineToken },
      });

      if (!response.ok) {
        this.logger.warn(`Catalog engine HTTP ${response.status} for page=${page}`);
        throw new ServiceUnavailableException('Не удалось получить каталог.');
      }

      const body = (await response.json()) as CatalogEngineResponse;

      if (body.code !== 200) {
        this.logger.warn(
          `Catalog engine returned code=${body.code} msg="${body.msg}" for page=${page}`,
        );
        throw new ServiceUnavailableException('Каталог временно недоступен.');
      }

      return body.data?.items ?? [];
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn('Catalog engine request failed', {
        page,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableException('Каталог временно недоступен.');
    }
  }
}
