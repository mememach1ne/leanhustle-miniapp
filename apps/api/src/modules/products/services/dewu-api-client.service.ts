import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getDewuEngineCredentials } from '../../../common/dewu-engine.config';
import { productResolveError } from '../product-resolve-error';

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
  /** Set by lh-dewu-engine when the portal session has expired. */
  needsRelogin?: boolean;
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
  private async request(params: Record<string, string>): Promise<DewuApiRawProductResponse> {
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
        throw productResolveError('ENGINE_UNAVAILABLE');
      }

      const body = (await response.json()) as DewuApiRawProductResponse;

      if (body.code !== 200) {
        this.logger.warn(
          `Dewu engine returned code=${body.code} msg="${body.msg}" needsRelogin=${Boolean(body.needsRelogin)} for ${spuId}`,
        );
        // The portal answered, but refused this particular item (e.g.
        // "portal 70400001: Unable to access item details") — other items
        // resolve fine, so it's not an outage. Everything else (proxy down,
        // session expired, timeouts, bad json) is.
        throw productResolveError(
          this.isPortalItemRejection(body) ? 'PRODUCT_NOT_AVAILABLE' : 'ENGINE_UNAVAILABLE',
        );
      }

      return body;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.warn('Dewu engine request failed', {
        params,
        error: error instanceof Error ? error.message : String(error),
      });
      throw productResolveError('ENGINE_UNAVAILABLE');
    }
  }

  /**
   * lh-dewu-engine reports `{ code: 502, msg: "portal <portalCode>: <portalMsg>" }`
   * when distribute.poizon.com itself returned a non-200 / empty answer for
   * the item. With `needsRelogin` it's an expired session (global outage);
   * without it, it's an item-level refusal.
   */
  private isPortalItemRejection(body: DewuApiRawProductResponse): boolean {
    return (
      body.code === 502 &&
      !body.needsRelogin &&
      typeof body.msg === 'string' &&
      body.msg.startsWith('portal ')
    );
  }
}
