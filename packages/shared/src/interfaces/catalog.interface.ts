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

/**
 * "best" = popularity/sales order (`popularityOrder` on the plain feed,
 * `soldRank` in search mode); price_asc/desc = by priceUsd. See
 * docs/SHOP_MVP_PLAN.md §v3.
 */
export type CatalogSortKey = 'best' | 'price_asc' | 'price_desc';

export interface CatalogListQuery {
  page?: number;
  limit?: number;
  sort?: CatalogSortKey;
}

/**
 * Фильтры/поиск: тип (чипы) и/или свободный текст (бренд или что угодно —
 * чипы брендов убраны, см. §"Фильтры и поиск (v2)" 2026-09-16) + сортировка.
 */
export interface CatalogSearchQuery {
  brand?: string;
  type?: string;
  q?: string;
  sort?: CatalogSortKey;
  page?: number;
  limit?: number;
}

/** Ответ на ручной триггер синка витрины (админ). */
export interface CatalogSyncResultDto {
  /** Товаров затронуто в проходе "Популярное" (GET /catalog). */
  synced: number;
  deactivated: number;
  pagesRead: number;
  /** Сколько keyword'ов из курируемого списка успешно синкнулись (GET /search). */
  keywordsSynced: number;
  /** Keyword'ы, для которых движок вернул ошибку — не остановили весь синк. */
  keywordErrors: number;
  syncedAt: string;
}
