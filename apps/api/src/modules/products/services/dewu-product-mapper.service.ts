import type { DewuProductSku, DewuResolvedProduct, ProductImage } from '@lean-poizon/shared';
import { Injectable, Logger } from '@nestjs/common';

import { productResolveError } from '../product-resolve-error';
import type { DewuApiRawProductResponse } from './dewu-api-client.service';

type DewuApiRawProductData = NonNullable<DewuApiRawProductResponse['data']>;

@Injectable()
export class DewuProductMapperService {
  private readonly logger = new Logger(DewuProductMapperService.name);

  mapProduct(
    payload: DewuApiRawProductResponse,
    resolvedLink: { originalLink: string; resolvedUrl: string; dwSpuId: string },
  ): DewuResolvedProduct {
    // Many product categories (watches, rings, some jewelry) come back as
    // code:200 with data:null because the portal doesn't expose them.
    // Activate manual mode with an explanation instead of surfacing the raw
    // "success" / "ok" msg to the customer.
    if (!payload.data) {
      this.logger.warn(`Engine returned no data for dwSpuId=${resolvedLink.dwSpuId}`);
      throw productResolveError('PRODUCT_UNPARSEABLE');
    }

    let product: DewuResolvedProduct;
    try {
      product = this.buildProduct(payload.data, resolvedLink);
    } catch (error) {
      // Unexpected card shape — report it as a product-level problem rather
      // than a 500 that the UI would read as an outage.
      this.logger.warn(`Failed to map dwSpuId=${resolvedLink.dwSpuId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw productResolveError('PRODUCT_UNPARSEABLE');
    }

    // A card with no SKUs, or with no SKU that has a GLOBAL price, can't be
    // priced or added to the cart — a dead card is worse than manual mode.
    if (product.availableSkus.length === 0) {
      this.logger.warn(
        `No purchasable SKUs for dwSpuId=${resolvedLink.dwSpuId} (skus=${product.skus.length})`,
      );
      throw productResolveError('PRODUCT_UNPARSEABLE');
    }

    return product;
  }

  private buildProduct(
    data: DewuApiRawProductData,
    resolvedLink: { originalLink: string; resolvedUrl: string; dwSpuId: string },
  ): DewuResolvedProduct {
    const skus = (data.skuList ?? []).map((sku) => {
      const attrs = sku.saleAttr ?? [];
      const sizeAttr = attrs.find((attr) => attr.enName === 'Size' || attr.cnName === '尺码');
      const versionAttr = attrs.find((attr) => attr.enName === 'Version' || attr.cnName === '版本');

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

    const gallery: ProductImage[] = (data.baseImage ?? []).filter(Boolean).map((url) => ({ url }));

    return {
      originalLink: resolvedLink.originalLink,
      resolvedUrl: resolvedLink.resolvedUrl,
      dwSpuId: String(data.dwSpuId),
      title: data.distSpuTitle || data.dwSpuTitle || '',
      brand: data.distBrandName,
      mainImage: data.image,
      gallery,
      categoryL1: data.distCategoryl1Name,
      categoryL2: data.distCategoryl2Name,
      categoryL3: data.distCategoryl3Name,
      sizeChart: data.sizeChart || undefined,
      skus,
      availableSkus: skus.filter((sku) => sku.isAvailable),
    };
  }
}
