import type { CatalogTypeOption } from '@lean-poizon/shared';

/** Type names are stored/sent in English (what the engine expects) but shown in Russian. */
export const CATALOG_TYPE_LABELS_RU: Record<CatalogTypeOption, string> = {
  Sneakers: 'Кроссовки',
  Jacket: 'Куртки',
  Hoodie: 'Худи',
  'T-Shirt': 'Футболки',
  Pants: 'Брюки',
  Shorts: 'Шорты',
  Bag: 'Сумки',
  Backpack: 'Рюкзаки',
  Cap: 'Кепки',
  Slides: 'Шлёпанцы',
  Accessories: 'Аксессуары',
};
