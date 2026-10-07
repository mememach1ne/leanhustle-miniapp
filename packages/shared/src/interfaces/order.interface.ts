import { OrderStatus } from '../enums/order-status.enum';
import type { DeliveryCategory } from '../enums/delivery-category.enum';
import type { ProductCategoryGroup } from '../enums/product-category-group.enum';
import type { DeliveryPickupPoint } from './delivery-address.interface';

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
  /** "Защита от рисков" (1% of the goods value), paid with delivery; 0 when off. */
  insuranceRub?: number;
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

/** Delivery priced by RAKETA, payable by the client via a top-up link. */
export interface OrderDeliveryPaymentDto {
  amountRub: number;
  /** «Международная доставка», «Доставка по РФ», пошлина, страховка… */
  lines: Array<{ name: string; amountRub: number }>;
}

/** One RAKETA milestone: Создан → На складе в Китае → … → Доставлен. */
export interface OrderTrackingStepDto {
  name: string;
  done: boolean;
  /** The latest reached milestone. */
  current: boolean;
}

/** Item of a consolidated order while the items travel to the China warehouse separately. */
export interface OrderTrackingItemDto {
  title: string;
  size: string;
  arrived: boolean;
  lastEvent: string | null;
}

/**
 * Parcel tracking for the client (from RAKETA's public tracker). RAKETA's own
 * numbers are never exposed to clients — only the CDEK track.
 */
export interface OrderTrackingDto {
  /** 'single' — one item; 'consolidation' — several items packed into one parcel. */
  kind: 'single' | 'consolidation';
  /** CDEK track of the RF leg, once RAKETA hands the parcel over. */
  cdekTrack: string | null;
  steps: OrderTrackingStepDto[];
  /** Newest first. */
  events: Array<{ name: string; at: string }>;
  /** Consolidation only: each item's way to the China warehouse. */
  items: OrderTrackingItemDto[];
}

export interface DeliveryPaymentLinkResponse {
  url: string;
  amountRub: number;
}

export interface OrderDetailsDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  /** Null until the order is paid. Distinguishes self-paid (crypto) vs manual. */
  paidVia?: PaymentSource | null;
  createdAt: string;
  updatedAt: string;
  trackCode?: string | null;
  subscriberBenefitApplied: boolean;
  subscriberBenefitAmountRub: number;
  delivery?: OrderDeliveryDto | null;
  summary: OrderSummaryDto;
  items: OrderItemDto[];
  statusHistory?: OrderStatusHistoryItemDto[];
  /** Set while the order waits for the client to pay the RAKETA delivery. */
  deliveryPayment?: OrderDeliveryPaymentDto | null;
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
  /** Optional — classified from the title/categories when omitted. */
  deliveryCategory?: DeliveryCategory;
  /** Size / variant label, optional for accessories without sizes. */
  sizeLabel?: string | null;
  versionLabel?: string | null;
  quantity: number;
  /** From the resolved Poizon product (improves delivery price + RAKETA data). */
  dwSpuId?: string | null;
  productImage?: string | null;
  titleCn?: string | null;
  categoryL1?: string | null;
  categoryL2?: string | null;
  categoryL3?: string | null;
  /** China-side track — registers the item in RAKETA right away. */
  chinaTrackNumber?: string | null;
}

/** Payload for staff/admin manual order creation (bot + mini-app). */
export interface CreateManualOrderRequest {
  /** Client Telegram @username (with or without leading @); empty with claimByLink. */
  username?: string;
  /** No client yet — they claim the order via a bot link and pay in the app. */
  claimByLink?: boolean;
  items: CreateManualOrderItem[];
  delivery: {
    fullName: string;
    cdekAddress: string;
    phone: string;
    comment?: string | null;
    pickupPoint?: DeliveryPickupPoint | null;
  };
  /** Commission % for this order (overrides the default and loyalty). */
  commissionPercent?: number | null;
  /** RAKETA "Защита от рисков" (1% of the goods value, paid with delivery). */
  insurance?: boolean;
  /** Goods already paid — the client doesn't need to pay. */
  alreadyPaid?: boolean;
  /** Title for the RAKETA consolidation / orders; auto when empty. */
  raketaTitle?: string | null;
}

/** Lightweight client snapshot returned by the manual-order lookup endpoint. */
export interface ManualOrderClientDto {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
}

/**
 * Response of GET /admin/orders/manual/lookup-client?username=... .
 * Lets bot/miniapp pre-fill saved addresses.
 */
export interface ManualOrderClientLookupResponse {
  client: ManualOrderClientDto;
  addresses: import('./delivery-address.interface').DeliveryAddressDto[];
}

export interface CreateManualOrderResponse {
  order: StaffOrderDetailsDto;
}

export interface StaffOrderFulfillmentItemDto {
  itemId: string;
  title: string;
  size: string;
  chinaTrackNumber: string | null;
  raketaOrderId: string | null;
  raketaTrackNumber: string | null;
}

/** RAKETA forwarder automation state (staff only). */
export interface StaffOrderFulfillmentDto {
  /** The manager handles this order by hand; automation skips it. */
  manual: boolean;
  consolidationId: string | null;
  lastError: string | null;
  /** Recipient + address were sent to RAKETA (order or consolidation). */
  deliveryAssigned: boolean;
  /** CDEK pickup point picked from the directory, e.g. "MSK1005, Москва"; null for hand-typed addresses. */
  pickupPoint: string | null;
  items: StaffOrderFulfillmentItemDto[];
  /** «Собрать» was pressed (by the server). */
  assembled: boolean;
  /** What RAKETA charges for delivery (null until it is weighed). */
  priceRub: number | null;
  /** Amount of the top-up link sent to the client. */
  topupRub: number | null;
  /** The client's top-up arrived. */
  clientPaid: boolean;
  /** The consolidation / order is paid at RAKETA. */
  raketaPaid: boolean;
}

export interface StaffOrderDetailsDto extends OrderDetailsDto {
  user: StaffOrderUserDto;
  statusHistory: StaffOrderStatusHistoryItemDto[];
  fulfillment: StaffOrderFulfillmentDto;
  /** Bot link for an order created without a client (null once claimed). */
  claimUrl: string | null;
}

export interface SetChinaTrackRequest {
  itemId: string;
  chinaTrackNumber: string;
}

export interface SetFulfillmentModeRequest {
  manual: boolean;
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
