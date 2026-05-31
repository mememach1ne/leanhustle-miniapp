import { DeliveryCategory } from '../enums/delivery-category.enum';
import { ProductCategoryGroup } from '../enums/product-category-group.enum';

export const getCategoryGroupFromDeliveryCategory = (
  deliveryCategory: DeliveryCategory,
): ProductCategoryGroup => {
  switch (deliveryCategory) {
    case DeliveryCategory.SNEAKERS:
    case DeliveryCategory.SLIDES:
    case DeliveryCategory.BOOTS:
    case DeliveryCategory.LOAFERS:
      return ProductCategoryGroup.FOOTWEAR;
    case DeliveryCategory.WATCH:
    case DeliveryCategory.GLASSES:
    case DeliveryCategory.BAG:
    case DeliveryCategory.SMALL_ACCESSORY:
    case DeliveryCategory.JEWELRY:
    case DeliveryCategory.PHONE_CASE:
    case DeliveryCategory.HEADWEAR:
    case DeliveryCategory.SCARF:
    case DeliveryCategory.PERFUME:
    case DeliveryCategory.TECH_ACCESSORY:
      return ProductCategoryGroup.ACCESSORIES;
    case DeliveryCategory.TSHIRT:
    case DeliveryCategory.SHORTS:
    case DeliveryCategory.PANTS:
    case DeliveryCategory.HOODIE:
    case DeliveryCategory.SWEATSHIRT:
    case DeliveryCategory.JACKET:
    case DeliveryCategory.VEST:
    case DeliveryCategory.DRESS:
    case DeliveryCategory.SKIRT:
    case DeliveryCategory.UNDERWEAR:
    case DeliveryCategory.GENERIC_APPAREL:
      return ProductCategoryGroup.APPAREL;
    case DeliveryCategory.OTHER:
    default:
      return ProductCategoryGroup.ACCESSORIES;
  }
};

export const DELIVERY_CATEGORY_LABELS: Record<DeliveryCategory, string> = {
  // Footwear
  [DeliveryCategory.SNEAKERS]: 'Кроссовки',
  [DeliveryCategory.SLIDES]: 'Сланцы / сандалии',
  [DeliveryCategory.BOOTS]: 'Ботинки',
  [DeliveryCategory.LOAFERS]: 'Лоферы / мокасины',

  // Apparel
  [DeliveryCategory.TSHIRT]: 'Футболка / поло',
  [DeliveryCategory.SHORTS]: 'Шорты',
  [DeliveryCategory.PANTS]: 'Брюки / джинсы',
  [DeliveryCategory.HOODIE]: 'Худи',
  [DeliveryCategory.SWEATSHIRT]: 'Свитшот',
  [DeliveryCategory.JACKET]: 'Куртка / пуховик',
  [DeliveryCategory.VEST]: 'Жилет',
  [DeliveryCategory.DRESS]: 'Платье',
  [DeliveryCategory.SKIRT]: 'Юбка',
  [DeliveryCategory.UNDERWEAR]: 'Бельё / носки',
  [DeliveryCategory.GENERIC_APPAREL]: 'Одежда (другое)',

  // Accessories
  [DeliveryCategory.WATCH]: 'Часы',
  [DeliveryCategory.GLASSES]: 'Очки',
  [DeliveryCategory.BAG]: 'Сумка / рюкзак',
  [DeliveryCategory.SMALL_ACCESSORY]: 'Кошелёк / ремень',
  [DeliveryCategory.JEWELRY]: 'Украшения',
  [DeliveryCategory.PHONE_CASE]: 'Чехол для телефона',
  [DeliveryCategory.HEADWEAR]: 'Кепка / шапка',
  [DeliveryCategory.SCARF]: 'Шарф / платок',
  [DeliveryCategory.PERFUME]: 'Парфюм',
  [DeliveryCategory.TECH_ACCESSORY]: 'Наушники / техника',

  // Other
  [DeliveryCategory.OTHER]: 'Другое',
};

export const getDeliveryCategoryLabel = (value: string): string =>
  DELIVERY_CATEGORY_LABELS[value as DeliveryCategory] ?? value;

export interface DeliveryCategoryGroup {
  key: string;
  label: string;
  emoji: string;
  categories: DeliveryCategory[];
}

export const DELIVERY_CATEGORY_GROUPS: DeliveryCategoryGroup[] = [
  {
    key: 'footwear',
    label: 'Обувь',
    emoji: '👟',
    categories: [
      DeliveryCategory.SNEAKERS,
      DeliveryCategory.SLIDES,
      DeliveryCategory.BOOTS,
      DeliveryCategory.LOAFERS,
    ],
  },
  {
    key: 'apparel',
    label: 'Одежда',
    emoji: '👕',
    categories: [
      DeliveryCategory.TSHIRT,
      DeliveryCategory.SHORTS,
      DeliveryCategory.PANTS,
      DeliveryCategory.HOODIE,
      DeliveryCategory.SWEATSHIRT,
      DeliveryCategory.JACKET,
      DeliveryCategory.VEST,
      DeliveryCategory.DRESS,
      DeliveryCategory.SKIRT,
      DeliveryCategory.UNDERWEAR,
      DeliveryCategory.GENERIC_APPAREL,
    ],
  },
  {
    key: 'accessories',
    label: 'Аксессуары',
    emoji: '👜',
    categories: [
      DeliveryCategory.BAG,
      DeliveryCategory.WATCH,
      DeliveryCategory.GLASSES,
      DeliveryCategory.JEWELRY,
      DeliveryCategory.SMALL_ACCESSORY,
      DeliveryCategory.HEADWEAR,
      DeliveryCategory.SCARF,
      DeliveryCategory.PHONE_CASE,
      DeliveryCategory.PERFUME,
      DeliveryCategory.TECH_ACCESSORY,
    ],
  },
  {
    key: 'other',
    label: 'Другое',
    emoji: '📦',
    categories: [DeliveryCategory.OTHER],
  },
];

export const getFallbackDeliveryCategoryForGroup = (
  categoryGroup: ProductCategoryGroup,
): DeliveryCategory => {
  switch (categoryGroup) {
    case ProductCategoryGroup.FOOTWEAR:
      return DeliveryCategory.SNEAKERS;
    case ProductCategoryGroup.ACCESSORIES:
      return DeliveryCategory.SMALL_ACCESSORY;
    case ProductCategoryGroup.APPAREL:
    default:
      return DeliveryCategory.GENERIC_APPAREL;
  }
};
