import { DeliveryCategory } from '@lean-poizon/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class DeliveryEstimationService {
  estimateDeliveryRub(params: {
    deliveryCategory: DeliveryCategory;
    deliveryPricePerKgRub: Prisma.Decimal;
  }): { estimatedWeightKg: number; deliveryRub: number } {
    const estimatedWeightKg = this.getWeightByDeliveryCategory(params.deliveryCategory);

    // OTHER — delivery calculated by manager, return 0
    if (estimatedWeightKg === 0) {
      return { estimatedWeightKg: 0, deliveryRub: 0 };
    }

    const deliveryRub = new Prisma.Decimal(estimatedWeightKg)
      .mul(params.deliveryPricePerKgRub)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

    return {
      estimatedWeightKg,
      deliveryRub: deliveryRub.toNumber(),
    };
  }

  private getWeightByDeliveryCategory(deliveryCategory: DeliveryCategory): number {
    switch (deliveryCategory) {
      // Footwear
      case DeliveryCategory.SNEAKERS:
        return 1.8;
      case DeliveryCategory.SLIDES:
        return 1.1;
      case DeliveryCategory.BOOTS:
        return 2.2;
      case DeliveryCategory.LOAFERS:
        return 1.4;

      // Apparel
      case DeliveryCategory.TSHIRT:
        return 0.4;
      case DeliveryCategory.SHORTS:
        return 0.5;
      case DeliveryCategory.PANTS:
        return 0.8;
      case DeliveryCategory.HOODIE:
        return 1;
      case DeliveryCategory.SWEATSHIRT:
        return 0.9;
      case DeliveryCategory.JACKET:
        return 1.4;
      case DeliveryCategory.VEST:
        return 0.6;
      case DeliveryCategory.DRESS:
        return 0.7;
      case DeliveryCategory.SKIRT:
        return 0.5;
      case DeliveryCategory.UNDERWEAR:
        return 0.2;

      // Accessories
      case DeliveryCategory.WATCH:
        return 0.3;
      case DeliveryCategory.GLASSES:
        return 0.25;
      case DeliveryCategory.BAG:
        return 1.2;
      case DeliveryCategory.SMALL_ACCESSORY:
        return 0.2;
      case DeliveryCategory.JEWELRY:
        return 0.15;
      case DeliveryCategory.PHONE_CASE:
        return 0.15;
      case DeliveryCategory.HEADWEAR:
        return 0.25;
      case DeliveryCategory.SCARF:
        return 0.3;
      case DeliveryCategory.PERFUME:
        return 0.5;
      case DeliveryCategory.TECH_ACCESSORY:
        return 0.4;

      // Other — manager will calculate
      case DeliveryCategory.OTHER:
        return 0;

      case DeliveryCategory.GENERIC_APPAREL:
      default:
        return 0.7;
    }
  }
}
