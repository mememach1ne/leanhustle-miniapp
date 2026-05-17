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
    return this.request(`dwSpuId=${encodeURIComponent(dwSpuId)}`);
  }

  async queryByLink(productLink: string): Promise<DewuApiRawProductResponse> {
    return this.request(`productLink=${productLink}`);
  }

  private async request(query: string): Promise<DewuApiRawProductResponse> {
    const host = this.configService.get<string>('integrations.rapidApiDewuHost');
    const apiKey = this.configService.get<string>('integrations.rapidApiDewuKey');
    const endpoint = this.configService.get<string>('integrations.rapidApiDewuProductEndpoint');

    if (!host || !apiKey || !endpoint) {
      throw new ServiceUnavailableException('RapidAPI Dewu не настроен на сервере.');
    }

    try {
      const response = await fetch(`https://${host}${endpoint}?${query}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': host,
          'x-rapidapi-key': apiKey,
        },
      });

      if (!response.ok) {
        this.logger.warn(`RapidAPI Dewu returned ${response.status} for ${query}`);
        throw new ServiceUnavailableException(
          'Не удалось получить товар через Dewu API. Попробуйте позже.',
        );
      }

      return (await response.json()) as DewuApiRawProductResponse;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn('Dewu API request failed', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableException(
        'Dewu API временно недоступен. Попробуйте позже.',
      );
    }
  }
}
