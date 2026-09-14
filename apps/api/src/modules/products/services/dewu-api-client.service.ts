import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getDewuEngineCredentials } from '../../../common/dewu-engine.config';

interface DewuApiRawSku {
  dwSkuId: number | string;
  minBidPrice?: number;
  saleAttr?: Array<{
    enName?: string;
    enValue?: string;
    cnName?: string;
    cnValue?: string;
  }>;
}

export interface DewuApiRawProductResponse {
  code: number;
  msg: string;
  data?: {
    dwSpuId: number | string;
    dwSpuTitle?: string;
    distSpuTitle?: string;
    image?: string;
    baseImage?: string[];
    distBrandName?: string;
    distCategoryl1Name?: string;
    distCategoryl2Name?: string;
    distCategoryl3Name?: string;
    sizeChart?: string;
    skuList?: DewuApiRawSku[];
  };
}

@Injectable()
export class DewuApiClientService {
  private readonly logger = new Logger(DewuApiClientService.name);
  private readonly configService: ConfigService;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.configService = configService;
  }

  async queryProductDetail(dwSpuId: string): Promise<DewuApiRawProductResponse> {
    return this.request({ dwSpuId });
  }

  /**
   * Fetches the product from our own price engine (lh-dewu-engine) running
   * on this VPS. The engine drives a headless browser through a proxy with
   * the operator's distribute.poizon.com session and returns the exact
   * DewuApiRawProductResponse shape the paid gateway used to return — so the
   * mapper and frontend need no changes. Replaces the paid dajisaas.com API.
   */
  private async request(
    params: Record<string, string>,
  ): Promise<DewuApiRawProductResponse> {
    const { engineUrl, engineToken } = getDewuEngineCredentials();
    const spuId = params.dwSpuId ?? '';
    const url = `${engineUrl}/raw/${encodeURIComponent(spuId)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'x-api-token': engineToken },
      });

      if (!response.ok) {
        this.logger.warn(`Dewu engine HTTP ${response.status} for ${spuId}`);
        throw new ServiceUnavailableException(
          'Не удалось получить товар. Попробуйте позже.',
        );
      }

      const body = (await response.json()) as DewuApiRawProductResponse;

      if (body.code !== 200) {
        this.logger.warn(
          `Dewu engine returned code=${body.code} msg="${body.msg}" for ${spuId}`,
        );
        // Session expired / portal error → let the frontend fall through to
        // manual-input mode with a Russian message.
        throw new ServiceUnavailableException(
          'Сервис товаров временно недоступен. Введите данные товара вручную или попробуйте позже.',
        );
      }

      return body;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn('Dewu engine request failed', {
        params,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableException(
        'Сервис товаров временно недоступен. Попробуйте позже.',
      );
    }
  }
}
