import { OrderStatus } from '../enums/order-status.enum';
import type { DeliveryCategory } from '../enums/delivery-category.enum';
import type { ProductCategoryGroup } from '../enums/product-category-group.enum';

export interface OrderSummaryDto {
  itemsCount: number;
  originalTotalUsd: number;
  benefitDiscountUsd: number;
  totalUsd: number;
  /** Estimated delivery (computed at checkout). */
  deliveryRub: number;
  /** Estimated duty (computed at checkout). */
  dutyRub: number;
  /** Manager-entered actual delivery. NULL until manager sets it. */
  actualDeliveryRub?: number | null;
  /** Manager-entered actual duty. NULL until manager sets it. */
  actualDutyRub?: number | null;
}

export interface StaffOrderUserDto {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
}

export interface StaffOrderStatusHistoryItemDto {
  id: string;
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  comment?: string | null;
  createdAt: string;
}

export interface OrderItemDto {
  id: string;
  dewuLink: string;
  dwSpuId: string;
  dwSkuId: string;
  image?: string | null;
  title: string;
  size: string;
  version?: string | null;
  quantity: number;
  priceYuan: number;
  totalUsd: number;
  deliveryRub: number;
  dutyRub: number;
  lineTotalUsd: number;
  lineDeliveryRub: number;
  lineDutyRub: number;
  categoryGroup: ProductCategoryGroup;
  deliveryCategory: DeliveryCategory;
  estimatedWeightKg: number;
}

export interface OrderListItemDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  trackCode?: string | null;
  subscriberBenefitApplied: boolean;
  subscriberBenefitAmountRub: number;
  totalUsd: number;
  deliveryRub: number;
  dutyRub: number;
  itemsCount: number;
  previewTitle?: string | null;
  previewImage?: string | null;
}

export interface OrderStatusHistoryItemDto {
  toStatus: OrderStatus;
  createdAt: string;
}

export interface OrderDeliveryDto {
  fullName: string;
  cdekAddress: string;
  phone: string;
}

/** How the goods payment was registered. */
export type PaymentSource = 'MANUAL' | 'CRYPTO_AUTO';

export interface OrderDetailsDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  /** Null until the order is paid. Distinguishes self-paid (crypto) vs manual. */
  paidVia?: PaymentSource | null;
  createdAt: string;
  updatedAt: string;
  trackCode?: string | null;
  isChannelSubscriberAtCheckout: boolean;
  subscriberBenefitApplied: boolean;
  subscriberBenefitAmountRub: number;
  delivery?: OrderDeliveryDto | null;
  summary: OrderSummaryDto;
  items: OrderItemDto[];
  statusHistory?: OrderStatusHistoryItemDto[];
}

export interface CheckoutOrderRequest {
  deliveryAddressId: string;
}

export interface CheckoutOrderResponse {
  order: OrderDetailsDto;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface UpdateOrderTrackCodeRequest {
  trackCode: string;
}

export interface SetActualDeliveryRequest {
  actualDeliveryRub: number;
}

export interface SetActualDutyRequest {
  actualDutyRub: number;
}

export interface CancelOrderRequest {
  reason?: string;
}

/** One item of a manually-entered order (staff fills these in by hand). */
export interface CreateManualOrderItem {
  /** Optional Poizon/Dewu link, shown for reference. */
  dewuLink?: string | null;
  productTitle: string;
  priceYuan: number;
  deliveryCategory: DeliveryCategory;
  /** Size / variant label, optional for accessories without sizes. */
  sizeLabel?: string | null;
  versionLabel?: string | null;
  quantity: number;
}

/** Payload for staff/admin manual order creation (bot + mini-app). */
export interface CreateManualOrderRequest {
  /** Client Telegram @username (with or without leading @). */
  username: string;
  items: CreateManualOrderItem[];
  delivery: {
    fullName: string;
    cdekAddress: string;
    phone: string;
    comment?: string | null;
  };
  /**
   * If true — force-apply the channel-subscriber first-order discount,
   * even if the client has already used it (resets hasUsedSubscriberBenefit
   * and applies the benefit to this order). Default: false.
   */
  applySubscriberBenefit?: boolean;
}

/** Lightweight client snapshot returned by the manual-order lookup endpoint. */
export interface ManualOrderClientDto {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
}

export interface ManualOrderClientSubscriptionDto {
  /** Currently a channel subscriber per latest refresh. */
  isChannelSubscriber: boolean;
  /** Client has already used the first-order subscriber benefit. */
  hasUsedSubscriberBenefit: boolean;
}

/**
 * Response of GET /admin/orders/manual/lookup-client?username=... .
 * Lets bot/miniapp pre-fill saved addresses + subscriber state.
 */
export interface ManualOrderClientLookupResponse {
  client: ManualOrderClientDto;
  addresses: import('./delivery-address.interface').DeliveryAddressDto[];
  subscription: ManualOrderClientSubscriptionDto;
}

export interface CreateManualOrderResponse {
  order: StaffOrderDetailsDto;
}

export interface StaffOrderDetailsDto extends OrderDetailsDto {
  user: StaffOrderUserDto;
  statusHistory: StaffOrderStatusHistoryItemDto[];
}

export interface StaffOrderListItemDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  trackCode?: string | null;
  subscriberBenefitApplied: boolean;
  subscriberBenefitAmountRub: number;
  totalUsd: number;
  deliveryRub: number;
  dutyRub: number;
  itemsCount: number;
  previewTitle?: string | null;
  previewImage?: string | null;
  user: StaffOrderUserDto;
}
