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
