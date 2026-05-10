import type { DewuProductSku, DewuResolvedProduct, ProductImage } from '@lean-poizon/shared';
import { Injectable, NotFoundException } from '@nestjs/common';

import type { DewuApiRawProductResponse } from './dewu-api-client.service';

@Injectable()
export class DewuProductMapperService {
  mapProduct(
    payload: DewuApiRawProductResponse,
    resolvedLink: { originalLink: string; resolvedUrl: string; dwSpuId: string },
  ): DewuResolvedProduct {
    if (payload.code !== 200 || !payload.data) {
      throw new NotFoundException(payload.msg || 'Товар Dewu не найден.');
    }

    const skus = (payload.data.skuList ?? []).map((sku) => {
      const sizeAttr = sku.saleAttr?.find(
        (attr) => attr.enName === 'Size' || attr.cnName === '尺码',
      );
      const versionAttr = sku.saleAttr?.find(
        (attr) => attr.enName === 'Version' || attr.cnName === '版本',
      );
      const minBidPrice = Number(sku.minBidPrice ?? 0);
      const isAvailable = Number.isFinite(minBidPrice) && minBidPrice > 0;

      return {
        dwSkuId: String(sku.dwSkuId),
        size: sizeAttr?.enValue ?? sizeAttr?.cnValue ?? 'Unknown size',
        version: versionAttr?.enValue ?? versionAttr?.cnValue,
        minBidPrice,
        isAvailable,
        priceYuan: isAvailable ? Number((minBidPrice / 100 + 2).toFixed(2)) : null,
      } satisfies DewuProductSku;
    });

    const gallery: ProductImage[] = (payload.data.baseImage ?? [])
      .filter(Boolean)
      .map((url) => ({ url }));

    return {
      originalLink: resolvedLink.originalLink,
      resolvedUrl: resolvedLink.resolvedUrl,
      dwSpuId: String(payload.data.dwSpuId),
      title: payload.data.distSpuTitle || payload.data.dwSpuTitle || '',
      brand: payload.data.distBrandName,
      mainImage: payload.data.image,
      gallery,
      categoryL1: payload.data.distCategoryl1Name,
      categoryL2: payload.data.distCategoryl2Name,
      categoryL3: payload.data.distCategoryl3Name,
      sizeChart: payload.data.sizeChart || undefined,
      skus,
      availableSkus: skus.filter((sku) => sku.isAvailable),
    };
  }
}
