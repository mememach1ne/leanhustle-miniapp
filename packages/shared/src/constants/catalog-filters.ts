/**
 * Filter taxonomy for the "Магазин" storefront search/filters panel.
 * See docs/SHOP_MVP_PLAN.md ("Фильтры и поиск (v2)"). Selecting a brand
 * and/or type builds a keyword ("nike jacket", "jacket", "nike") sent to
 * the engine's GET /search?q=. Kept as a plain TS constant for MVP — moving
 * this to a DB-editable taxonomy is a follow-up, not required to ship v2.
 */
export const CATALOG_TYPE_OPTIONS = [
  'Sneakers',
  'Jacket',
  'Hoodie',
  'T-Shirt',
  'Pants',
  'Shorts',
  'Bag',
  'Backpack',
  'Cap',
  'Slides',
  'Accessories',
] as const;

export const CATALOG_BRAND_OPTIONS = [
  'Nike',
  'Adidas',
  'Jordan',
  'New Balance',
  'Puma',
  'ASICS',
  'Vans',
  'Converse',
  'Salomon',
  'UGG',
  'The North Face',
  'Stussy',
  'Crocs',
  'Reebok',
  'Yeezy',
  'Li-Ning',
  'Anta',
] as const;

export type CatalogTypeOption = (typeof CATALOG_TYPE_OPTIONS)[number];
export type CatalogBrandOption = (typeof CATALOG_BRAND_OPTIONS)[number];

/**
 * Normalizes a brand/type/free-text combo into the lowercase keyword string
 * sent to the engine and used as the DB tag in CatalogProduct.keywords.
 * Both sides (frontend query building and backend nightly sync) must use
 * this exact function so tags line up.
 */
export function buildCatalogKeyword(parts: Array<string | undefined | null>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim().toLowerCase())
    .join(' ');
}

/**
 * Curated "brand + type" combos worth pre-warming in the nightly snapshot,
 * on top of every solo brand and solo type. Picked for resale-market
 * relevance, not exhaustive (brand × type would be 17×11=187 keywords —
 * far more than the engine can cold-fetch in one nightly run). Edit this
 * list to change what gets pre-cached; nothing else needs to change.
 */
const CURATED_BRAND_TYPE_COMBOS: ReadonlyArray<[CatalogBrandOption, CatalogTypeOption]> = [
  ['Nike', 'Sneakers'],
  ['Adidas', 'Sneakers'],
  ['Jordan', 'Sneakers'],
  ['New Balance', 'Sneakers'],
  ['Puma', 'Sneakers'],
  ['ASICS', 'Sneakers'],
  ['Vans', 'Sneakers'],
  ['Converse', 'Sneakers'],
  ['Salomon', 'Sneakers'],
  ['Yeezy', 'Sneakers'],
  ['Nike', 'Jacket'],
  ['The North Face', 'Jacket'],
  ['Nike', 'Hoodie'],
  ['Adidas', 'Hoodie'],
  ['Stussy', 'Hoodie'],
  ['Nike', 'T-Shirt'],
  ['Stussy', 'T-Shirt'],
  ['Nike', 'Cap'],
  ['UGG', 'Slides'],
  ['Crocs', 'Slides'],
];

/**
 * Full curated keyword list for the nightly snapshot sync: every solo
 * brand, every solo type, plus the hand-picked combos above. ~48 entries —
 * matches the plan's ~40-60 target (60/keyword × ~50 ≈ 2.5-3k cards).
 */
export const CATALOG_SNAPSHOT_KEYWORDS: string[] = [
  ...CATALOG_TYPE_OPTIONS.map((type) => buildCatalogKeyword([type])),
  ...CATALOG_BRAND_OPTIONS.map((brand) => buildCatalogKeyword([brand])),
  ...CURATED_BRAND_TYPE_COMBOS.map(([brand, type]) => buildCatalogKeyword([brand, type])),
];
