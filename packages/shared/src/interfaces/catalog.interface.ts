/** Одна карточка витрины «Магазин» (список, не деталь товара). */
export interface CatalogProductDto {
  spuId: string;
  title: string;
  article: string | null;
  imageUrl: string;
  /** USD — конвертация в рубли пока отложена, см. docs/SHOP_MVP_PLAN.md §6. */
  priceUsd: number;
  priceCny: number;
  /** Сырой текст с движка, напр. "64w+". Может отсутствовать. */
  soldText: string | null;
  /** Распарсенное число продаж (напр. 640000) — для человекочитаемой метки на фронте. */
  soldRank: number;
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
