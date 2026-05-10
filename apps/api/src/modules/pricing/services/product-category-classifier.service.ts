import {
  DeliveryCategory,
  getCategoryGroupFromDeliveryCategory,
  ProductCategoryGroup,
} from '@lean-poizon/shared';
import { Injectable } from '@nestjs/common';

interface ProductCategoryInput {
  title: string;
  categoryL1?: string;
  categoryL2?: string;
  categoryL3?: string;
}

interface ClassificationResult {
  categoryGroup: ProductCategoryGroup;
  deliveryCategory: DeliveryCategory;
}

@Injectable()
export class ProductCategoryClassifierService {
  classify(input: ProductCategoryInput): ClassificationResult {
    const haystack = this.normalize([
      input.title,
      input.categoryL1,
      input.categoryL2,
      input.categoryL3,
    ]);

    const deliveryCategory =
      this.matchFirst(haystack, {
        [DeliveryCategory.WATCH]: ['watch', 'watches'],
        [DeliveryCategory.GLASSES]: ['glasses', 'sunglasses', 'eyewear'],
        [DeliveryCategory.BAG]: ['bag', 'bags', 'backpack', 'backpacks', 'shoulder bag'],
        [DeliveryCategory.JEWELRY]: ['jewelry', 'necklace', 'bracelet', 'ring', 'earring'],
        [DeliveryCategory.PHONE_CASE]: ['phone case', 'phone cover', 'iphone case'],
        [DeliveryCategory.HEADWEAR]: ['cap', 'hat', 'beanie', 'bucket hat', 'headband'],
        [DeliveryCategory.SCARF]: ['scarf', 'scarves', 'shawl'],
        [DeliveryCategory.PERFUME]: ['perfume', 'cologne', 'fragrance', 'eau de'],
        [DeliveryCategory.TECH_ACCESSORY]: ['earbuds', 'headphones', 'airpods', 'speaker'],
        [DeliveryCategory.SMALL_ACCESSORY]: [
          'accessory',
          'accessories',
          'wallet',
          'belt',
          'keychain',
        ],
        [DeliveryCategory.BOOTS]: ['boots', 'boot'],
        [DeliveryCategory.LOAFERS]: ['loafer', 'loafers', 'moccasin'],
        [DeliveryCategory.SLIDES]: ['slides', 'slippers', 'sandals', 'slide sandal'],
        [DeliveryCategory.SNEAKERS]: [
          'sneakers',
          'skateboard shoes',
          'running shoes',
          'casual shoes',
          'shoes',
          'shoe',
          'footwear',
        ],
        [DeliveryCategory.TSHIRT]: ['t-shirt', 't shirt', 'tee', 'tees', 'polo'],
        [DeliveryCategory.SHORTS]: ['shorts'],
        [DeliveryCategory.PANTS]: ['pants', 'sports pants', 'trousers', 'jeans'],
        [DeliveryCategory.HOODIE]: ['hoodie', 'hooded'],
        [DeliveryCategory.SWEATSHIRT]: ['sweatshirt', 'crewneck'],
        [DeliveryCategory.JACKET]: ['jacket', 'down jacket', 'coat', 'parka', 'windbreaker'],
        [DeliveryCategory.VEST]: ['vest', 'gilet'],
        [DeliveryCategory.DRESS]: ['dress', 'gown'],
        [DeliveryCategory.SKIRT]: ['skirt'],
        [DeliveryCategory.UNDERWEAR]: ['underwear', 'socks', 'boxers', 'briefs', 'bra'],
      }) ?? DeliveryCategory.GENERIC_APPAREL;

    return {
      categoryGroup: getCategoryGroupFromDeliveryCategory(deliveryCategory),
      deliveryCategory,
    };
  }

  private normalize(values: Array<string | undefined>) {
    return values
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/[_/()-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private matchFirst(
    value: string,
    patterns: Partial<Record<DeliveryCategory, string[]>>,
  ): DeliveryCategory | null {
    for (const [category, needles] of Object.entries(patterns) as Array<
      [DeliveryCategory, string[]]
    >) {
      if (needles.some((needle) => value.includes(needle))) {
        return category;
      }
    }

    return null;
  }
}
