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
  /** Optional "Защита от рисков": 1% of the goods value in RUB (estimate). */
  insuranceRub?: number;
}

/** Cart delivery priced to the nearest million-plus city of the chosen address. */
export interface CartDeliveryEstimateResponse {
  deliveryRub: number;
  /** «Москва» when no address / region is known. */
  hubCity: string;
}

export interface CartResponse {
  id: string;
  items: CartItemDto[];
  summary: CartSummaryDto;
  updatedAt: string;
}
