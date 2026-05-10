import type { DeliveryCategory } from '../enums/delivery-category.enum';
import type { ProductCategoryGroup } from '../enums/product-category-group.enum';

export interface AddToCartRequest {
  dewuLink: string;
  dwSpuId: string;
  dwSkuId: string;
  productTitle: string;
  productImage?: string;
  size: string;
  version?: string;
  categoryL1?: string;
  categoryL2?: string;
  categoryL3?: string;
  priceYuan: number;
  totalUsd: number;
  deliveryRub: number;
  dutyRub: number;
  categoryGroup: ProductCategoryGroup;
  deliveryCategory: DeliveryCategory;
  estimatedWeightKg: number;
  quantity?: number;
}

export interface UpdateCartItemQuantityRequest {
  quantity: number;
}

export interface CartItemDto {
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

export interface CartSummaryDto {
  itemsCount: number;
  cartTotalUsd: number;
  cartDeliveryRub: number;
  cartDutyRub: number;
}

export interface CartResponse {
  id: string;
  items: CartItemDto[];
  summary: CartSummaryDto;
  updatedAt: string;
}
