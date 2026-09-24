export interface ProductImage {
  url: string;
  alt?: string;
}

export interface DewuProductSku {
  dwSkuId: string;
  size: string;
  version?: string;
  minBidPrice: number;
  isAvailable: boolean;
  priceYuan: number | null;
}

export interface DewuResolvedProduct {
  originalLink: string;
  resolvedUrl: string;
  dwSpuId: string;
  title: string;
  brand?: string;
  mainImage?: string;
  gallery: ProductImage[];
  categoryL1?: string;
  categoryL2?: string;
  categoryL3?: string;
  sizeChart?: string;
  skus: DewuProductSku[];
  availableSkus: DewuProductSku[];
}

export interface ResolveProductRequest {
  link: string;
}

/**
 * Machine-readable reason carried in the `code` field of a failed product
 * resolve response, so the UI can explain what actually went wrong:
 * - LINK_UNRECOGNIZED     — link couldn't be parsed / expanded to a spuId (400)
 * - PRODUCT_NOT_AVAILABLE — Poizon's distribution portal refuses to return this item (422)
 * - PRODUCT_UNPARSEABLE   — item returned, but without usable sizes/prices (422)
 * - ENGINE_UNAVAILABLE    — price engine unreachable / session expired / upstream error (503)
 */
export type ProductResolveErrorCode =
  | 'LINK_UNRECOGNIZED'
  | 'PRODUCT_NOT_AVAILABLE'
  | 'PRODUCT_UNPARSEABLE'
  | 'ENGINE_UNAVAILABLE';
