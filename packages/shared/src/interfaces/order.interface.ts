import { OrderStatus } from '../enums/order-status.enum';
import type { DeliveryCategory } from '../enums/delivery-category.enum';
import type { ProductCategoryGroup } from '../enums/product-category-group.enum';

export interface OrderSummaryDto {
  itemsCount: number;
  originalTotalUsd: number;
  benefitDiscountUsd: number;
  totalUsd: number;
  deliveryRub: number;
  dutyRub: number;
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

export interface OrderDetailsDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
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
