export interface PoizonNormalizedSku {
  dwSkuId: string;
  sizeLabel: string;
  versionLabel?: string;
  minBidPrice: number;
  basePriceCny: number;
}

export interface PoizonProductDetailResponse {
  dwSpuId: string;
  resolvedUrl?: string;
  title: string;
  image?: string;
  brand?: string;
  categoryLevel1?: string;
  categoryLevel2?: string;
  categoryLevel3?: string;
  availableSizes: PoizonNormalizedSku[];
  totalSkuCount: number;
  availableSkuCount: number;
}
