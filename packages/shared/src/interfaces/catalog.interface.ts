/** Одна карточка витрины «Магазин» (список, не деталь товара). */
export interface CatalogProductDto {
  spuId: string;
  title: string;
  article: string | null;
  imageUrl: string;
  priceRub: number;
  priceCny: number;
  /** Сырой текст с движка, напр. "64w+". Может отсутствовать. */
  soldText: string | null;
}

export interface CatalogListResponse {
  items: CatalogProductDto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface CatalogListQuery {
  page?: number;
  limit?: number;
}

/** Ответ на ручной триггер синка витрины (админ). */
export interface CatalogSyncResultDto {
  synced: number;
  deactivated: number;
  pagesRead: number;
  syncedAt: string;
}
