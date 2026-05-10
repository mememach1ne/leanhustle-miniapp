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
