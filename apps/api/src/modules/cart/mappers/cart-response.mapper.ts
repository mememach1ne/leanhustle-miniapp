import type { CartItemDto, CartResponse, CartSummaryDto } from '@lean-poizon/shared';
import {
  DeliveryCategory,
  getFallbackDeliveryCategoryForGroup,
  ProductCategoryGroup,
} from '@lean-poizon/shared';
import { Prisma } from '@prisma/client';

type CartWithItems = {
  id: string;
  updatedAt: Date;
  items: Array<{
    id: string;
    dewuLink: string;
    dwSpuId: string;
    dwSkuId: string;
    productTitle: string;
    productImage: string | null;
    sizeLabel: string;
    versionLabel: string | null;
    quantity: number;
    priceYuan: Prisma.Decimal;
    totalUsd: Prisma.Decimal;
    deliveryRub: Prisma.Decimal;
    dutyRub: Prisma.Decimal;
    categoryGroup: string;
    deliveryCategory: string | null;
    estimatedWeightKg: Prisma.Decimal;
  }>;
};

const roundUsd = (value: Prisma.Decimal): number => {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
};

const roundRub = (value: Prisma.Decimal): number => {
  return value.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
};

const resolveDeliveryCategory = (
  deliveryCategory: string | null,
  categoryGroup: ProductCategoryGroup,
): DeliveryCategory => {
  if (deliveryCategory && Object.values(DeliveryCategory).includes(deliveryCategory as DeliveryCategory)) {
    return deliveryCategory as DeliveryCategory;
  }

  return getFallbackDeliveryCategoryForGroup(categoryGroup);
};

export const mapCartToResponse = (cart: CartWithItems): CartResponse => {
  const items: CartItemDto[] = cart.items.map((item) => {
    const quantityDecimal = new Prisma.Decimal(item.quantity);
    const lineTotalUsd = item.totalUsd.mul(quantityDecimal);
    const lineDeliveryRub = item.deliveryRub.mul(quantityDecimal);
    const lineDutyRub = item.dutyRub.mul(quantityDecimal);
    const categoryGroup = item.categoryGroup as ProductCategoryGroup;

    return {
      id: item.id,
      dewuLink: item.dewuLink,
      dwSpuId: item.dwSpuId,
      dwSkuId: item.dwSkuId,
      image: item.productImage,
      title: item.productTitle,
      size: item.sizeLabel,
      version: item.versionLabel,
      quantity: item.quantity,
      priceYuan: roundUsd(item.priceYuan),
      totalUsd: roundUsd(item.totalUsd),
      deliveryRub: roundRub(item.deliveryRub),
      dutyRub: roundRub(item.dutyRub),
      lineTotalUsd: roundUsd(lineTotalUsd),
      lineDeliveryRub: roundRub(lineDeliveryRub),
      lineDutyRub: roundRub(lineDutyRub),
      categoryGroup,
      deliveryCategory: resolveDeliveryCategory(item.deliveryCategory, categoryGroup),
      estimatedWeightKg: roundUsd(item.estimatedWeightKg),
    };
  });

  const summary = items.reduce<CartSummaryDto>(
    (acc, item) => ({
      itemsCount: acc.itemsCount + item.quantity,
      cartTotalUsd: Number((acc.cartTotalUsd + item.lineTotalUsd).toFixed(2)),
      cartDeliveryRub: Math.round(acc.cartDeliveryRub + item.lineDeliveryRub),
      cartDutyRub: Math.round(acc.cartDutyRub + item.lineDutyRub),
    }),
    {
      itemsCount: 0,
      cartTotalUsd: 0,
      cartDeliveryRub: 0,
      cartDutyRub: 0,
    },
  );

  return {
    id: cart.id,
    items,
    summary,
    updatedAt: cart.updatedAt.toISOString(),
  };
};
