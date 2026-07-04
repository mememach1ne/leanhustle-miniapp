import type {
  OrderDetailsDto,
  OrderItemDto,
  OrderListItemDto,
  OrderStatusHistoryItemDto,
  OrderSummaryDto,
  StaffOrderDetailsDto,
  StaffOrderListItemDto,
  StaffOrderStatusHistoryItemDto,
} from '@lean-poizon/shared';
import {
  DeliveryCategory,
  getFallbackDeliveryCategoryForGroup,
  ProductCategoryGroup,
} from '@lean-poizon/shared';
import { Prisma } from '@prisma/client';

type OrderWithItems = {
  id: string;
  orderNumber: string;
  status: string;
  paidVia: string | null;
  createdAt: Date;
  updatedAt: Date;
  trackCode: string | null;
  isChannelSubscriberAtCheckout: boolean;
  subscriberBenefitApplied: boolean;
  subscriberBenefitAmountRub: Prisma.Decimal;
  itemsCount: number;
  originalTotalUsd: Prisma.Decimal;
  benefitDiscountUsd: Prisma.Decimal;
  totalUsd: Prisma.Decimal;
  deliveryRub: Prisma.Decimal;
  dutyRub: Prisma.Decimal;
  actualDeliveryRub: Prisma.Decimal | null;
  actualDutyRub: Prisma.Decimal | null;
  deliveryFullName: string | null;
  deliveryCdekAddress: string | null;
  deliveryPhone: string | null;
  user?: {
    id: string;
    telegramId: string;
    username: string | null;
    firstName: string;
    lastName: string | null;
  };
  statusHistory?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    comment: string | null;
    createdAt: Date;
  }>;
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

export const mapOrderItemToDto = (item: OrderWithItems['items'][number]): OrderItemDto => {
  const quantityDecimal = new Prisma.Decimal(item.quantity);
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
    lineTotalUsd: roundUsd(item.totalUsd.mul(quantityDecimal)),
    lineDeliveryRub: roundRub(item.deliveryRub.mul(quantityDecimal)),
    lineDutyRub: roundRub(item.dutyRub.mul(quantityDecimal)),
    categoryGroup,
    deliveryCategory: resolveDeliveryCategory(item.deliveryCategory, categoryGroup),
    estimatedWeightKg: roundUsd(item.estimatedWeightKg),
  };
};

export const mapOrderSummaryToDto = (order: OrderWithItems): OrderSummaryDto => {
  return {
    itemsCount: order.itemsCount,
    originalTotalUsd: roundUsd(order.originalTotalUsd),
    benefitDiscountUsd: roundUsd(order.benefitDiscountUsd),
    totalUsd: roundUsd(order.totalUsd),
    deliveryRub: roundRub(order.deliveryRub),
    dutyRub: roundRub(order.dutyRub),
    actualDeliveryRub: order.actualDeliveryRub === null ? null : roundRub(order.actualDeliveryRub),
    actualDutyRub: order.actualDutyRub === null ? null : roundRub(order.actualDutyRub),
  };
};

export const mapOrderToDetailsDto = (order: OrderWithItems): OrderDetailsDto => {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as OrderDetailsDto['status'],
    paidVia: (order.paidVia as OrderDetailsDto['paidVia']) ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    trackCode: order.trackCode,
    isChannelSubscriberAtCheckout: order.isChannelSubscriberAtCheckout,
    subscriberBenefitApplied: order.subscriberBenefitApplied,
    subscriberBenefitAmountRub: roundRub(order.subscriberBenefitAmountRub),
    delivery: order.deliveryFullName
      ? {
          fullName: order.deliveryFullName,
          cdekAddress: order.deliveryCdekAddress!,
          phone: order.deliveryPhone!,
        }
      : null,
    summary: mapOrderSummaryToDto(order),
    items: order.items.map(mapOrderItemToDto),
    statusHistory:
      order.statusHistory?.map<OrderStatusHistoryItemDto>((item) => ({
        toStatus: item.toStatus as OrderStatusHistoryItemDto['toStatus'],
        createdAt: item.createdAt.toISOString(),
      })) ?? [],
  };
};

export const mapOrderToListItemDto = (
  order: Omit<OrderWithItems, 'items'> & {
    items: Array<{
      productTitle: string;
      productImage: string | null;
    }>;
  },
): OrderListItemDto => {
  const firstItem = order.items[0];

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as OrderListItemDto['status'],
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    trackCode: order.trackCode,
    subscriberBenefitApplied: order.subscriberBenefitApplied,
    subscriberBenefitAmountRub: roundRub(order.subscriberBenefitAmountRub),
    totalUsd: roundUsd(order.totalUsd),
    deliveryRub: roundRub(order.deliveryRub),
    dutyRub: roundRub(order.dutyRub),
    itemsCount: order.itemsCount,
    previewTitle: firstItem?.productTitle ?? null,
    previewImage: firstItem?.productImage ?? null,
  };
};

export const mapOrderToStaffDetailsDto = (
  order: OrderWithItems & {
    user: {
      id: string;
      telegramId: string;
      username: string | null;
      firstName: string;
      lastName: string | null;
    };
  },
): StaffOrderDetailsDto => {
  return {
    ...mapOrderToDetailsDto(order),
    user: {
      id: order.user.id,
      telegramId: order.user.telegramId,
      username: order.user.username,
      firstName: order.user.firstName,
      lastName: order.user.lastName,
    },
    statusHistory:
      order.statusHistory?.map<StaffOrderStatusHistoryItemDto>((item) => ({
        id: item.id,
        fromStatus: item.fromStatus as StaffOrderStatusHistoryItemDto['fromStatus'],
        toStatus: item.toStatus as StaffOrderStatusHistoryItemDto['toStatus'],
        comment: item.comment,
        createdAt: item.createdAt.toISOString(),
      })) ?? [],
  };
};

export const mapOrderToStaffListItemDto = (
  order: Omit<OrderWithItems, 'items'> & {
    user: {
      id: string;
      telegramId: string;
      username: string | null;
      firstName: string;
      lastName: string | null;
    };
    items: Array<{
      productTitle: string;
      productImage: string | null;
    }>;
  },
): StaffOrderListItemDto => {
  const firstItem = order.items[0];

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as StaffOrderListItemDto['status'],
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    trackCode: order.trackCode,
    subscriberBenefitApplied: order.subscriberBenefitApplied,
    subscriberBenefitAmountRub: roundRub(order.subscriberBenefitAmountRub),
    totalUsd: roundUsd(order.totalUsd),
    deliveryRub: roundRub(order.deliveryRub),
    dutyRub: roundRub(order.dutyRub),
    itemsCount: order.itemsCount,
    previewTitle: firstItem?.productTitle ?? null,
    previewImage: firstItem?.productImage ?? null,
    user: {
      id: order.user.id,
      telegramId: order.user.telegramId,
      username: order.user.username,
      firstName: order.user.firstName,
      lastName: order.user.lastName,
    },
  };
};
