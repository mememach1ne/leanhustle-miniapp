import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
   * Calls the Dewu/Poizon OpenAPI gateway (currently dajisaas.com).
   * Auth is appKey + appSecret as URL query parameters — no headers.
   */
  private async request(
    params: Record<string, string>,
  ): Promise<DewuApiRawProductResponse> {
    const host = this.configService.get<string>('integrations.dewuApiHost');
    const appKey = this.configService.get<string>('integrations.dewuApiAppKey');
    const appSecret = this.configService.get<string>('integrations.dewuApiAppSecret');
    const endpoint = this.configService.get<string>('integrations.dewuApiProductEndpoint');

    if (!host || !appKey || !appSecret || !endpoint) {
      throw new ServiceUnavailableException('Dewu API не настроен на сервере.');
    }

    const query = new URLSearchParams({ appKey, appSecret, ...params }).toString();
    const url = `https://${host}${endpoint}?${query}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        this.logger.warn(`Dewu API HTTP ${response.status} for ${params.dwSpuId ?? ''}`);
        throw new ServiceUnavailableException(
          'Не удалось получить товар через Dewu API. Попробуйте позже.',
        );
      }

      const body = (await response.json()) as DewuApiRawProductResponse;

      if (body.code !== 200) {
        this.logger.warn(
          `Dewu API returned code=${body.code} msg="${body.msg}" for ${params.dwSpuId ?? ''}`,
        );
      }

      return body;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn('Dewu API request failed', {
        params,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableException(
        'Dewu API временно недоступен. Попробуйте позже.',
      );
    }
  }
}
