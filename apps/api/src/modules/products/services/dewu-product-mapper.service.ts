import type { DewuProductSku, DewuResolvedProduct, ProductImage } from '@lean-poizon/shared';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import type { DewuApiRawProductResponse } from './dewu-api-client.service';

@Injectable()
export class DewuProductMapperService {
  mapProduct(
    payload: DewuApiRawProductResponse,
    resolvedLink: { originalLink: string; resolvedUrl: string; dwSpuId: string },
  ): DewuResolvedProduct {
    // Treat missing data the same as upstream failures — many product
    // categories (watches, rings, some jewelry) return code:200 with
    // data:null because the Dewu API doesn't expose them. Activate
    // manual mode instead of surfacing the raw "success" / "ok" msg
    // to the customer.
    if (!payload.data) {
      throw new ServiceUnavailableException(
        'Не удалось получить данные о товаре автоматически. Введите вручную или попробуйте другую ссылку.',
      );
    }

    const skus = (payload.data.skuList ?? []).map((sku) => {
      const attrs = sku.saleAttr ?? [];
      const sizeAttr = attrs.find(
        (attr) => attr.enName === 'Size' || attr.cnName === '尺码',
      );
      const versionAttr = attrs.find(
        (attr) => attr.enName === 'Version' || attr.cnName === '版本',
      );

      // Poizon products beyond clothing/footwear use different saleAttr
      // schemes — backpacks have Model/Color, perfumes have Volume in ml,
      // electronics have Capacity. Concatenate every attribute value so
      // the customer sees the real SKU description ("100ml", "Black / 30L",
      // "EU 42") instead of a bogus "Unknown size".
      const variantLabel =
        attrs
          .map((attr) => attr.enValue ?? attr.cnValue)
          .filter((value): value is string => Boolean(value && value.trim()))
          .join(' / ') || 'Стандартный вариант';

      const minBidPrice = Number(sku.minBidPrice ?? 0);
      const isAvailable = Number.isFinite(minBidPrice) && minBidPrice > 0;

      return {
        dwSkuId: String(sku.dwSkuId),
        size: sizeAttr?.enValue ?? sizeAttr?.cnValue ?? variantLabel,
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
