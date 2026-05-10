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
    const host = this.configService.get<string>('integrations.rapidApiDewuHost');
    const apiKey = this.configService.get<string>('integrations.rapidApiDewuKey');
    const endpoint = this.configService.get<string>('integrations.rapidApiDewuProductEndpoint');

    if (!host || !apiKey || !endpoint) {
      throw new ServiceUnavailableException('RapidAPI Dewu не настроен на сервере.');
    }

    try {
      const response = await fetch(`https://${host}${endpoint}?dwSpuId=${dwSpuId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': host,
          'x-rapidapi-key': apiKey,
        },
      });

      if (!response.ok) {
        this.logger.warn(`RapidAPI Dewu returned ${response.status} for dwSpuId=${dwSpuId}`);
        throw new ServiceUnavailableException(
          'Не удалось получить товар через Dewu API. Попробуйте позже.',
        );
      }

      return (await response.json()) as DewuApiRawProductResponse;
    } catch (error) {
      this.logger.warn('Dewu API request failed', {
        dwSpuId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableException(
        'Dewu API временно недоступен. Попробуйте позже.',
      );
    }
  }
}
