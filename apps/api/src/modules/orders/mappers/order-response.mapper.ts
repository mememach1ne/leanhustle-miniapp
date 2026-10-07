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
  fulfillmentManual?: boolean;
  raketaConsolidationId?: string | null;
  raketaLastError?: string | null;
  raketaDeliveryAssignedAt?: Date | null;
  claimToken?: string | null;
  insuranceRub?: Prisma.Decimal;
  deliveryPvzCode?: string | null;
  deliveryCity?: string | null;
  user?: {
    id: string;
    telegramId: string;
    username: string | null;
    firstName: string;
    lastName: string | null;
  } | null;
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
    chinaTrackNumber?: string | null;
    raketaOrderId?: string | null;
    raketaTrackNumber?: string | null;
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
    insuranceRub: order.insuranceRub ? roundRub(order.insuranceRub) : 0,
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

type StaffUserSource = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
};

/** Orders created for a not-yet-known client have no owner until claimed via the bot link. */
const mapStaffUser = (user: StaffUserSource | null) =>
  user
    ? {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      }
    : { id: '', telegramId: '', username: null, firstName: 'Ожидает клиента (ссылка)', lastName: null };

export const mapOrderToStaffDetailsDto = (
  order: OrderWithItems & {
    user: StaffUserSource | null;
  },
): StaffOrderDetailsDto => {
  return {
    ...mapOrderToDetailsDto(order),
    user: mapStaffUser(order.user),
    claimUrl: order.claimToken ? `https://t.me/lh_poizonbot?start=pay_${order.claimToken}` : null,
    statusHistory:
      order.statusHistory?.map<StaffOrderStatusHistoryItemDto>((item) => ({
        id: item.id,
        fromStatus: item.fromStatus as StaffOrderStatusHistoryItemDto['fromStatus'],
        toStatus: item.toStatus as StaffOrderStatusHistoryItemDto['toStatus'],
        comment: item.comment,
        createdAt: item.createdAt.toISOString(),
      })) ?? [],
    fulfillment: {
      manual: order.fulfillmentManual ?? false,
      consolidationId: order.raketaConsolidationId ?? null,
      lastError: order.raketaLastError ?? null,
      deliveryAssigned: Boolean(order.raketaDeliveryAssignedAt),
      pickupPoint: order.deliveryPvzCode
        ? `${order.deliveryPvzCode}${order.deliveryCity ? `, ${order.deliveryCity}` : ''}`
        : null,
      items: order.items.map((item) => ({
        itemId: item.id,
        title: item.productTitle,
        size: item.sizeLabel,
        chinaTrackNumber: item.chinaTrackNumber ?? null,
        raketaOrderId: item.raketaOrderId ?? null,
        raketaTrackNumber: item.raketaTrackNumber ?? null,
      })),
    },
  };
};

export const mapOrderToStaffListItemDto = (
  order: Omit<OrderWithItems, 'items'> & {
    user: StaffUserSource | null;
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
    user: mapStaffUser(order.user),
  };
};
