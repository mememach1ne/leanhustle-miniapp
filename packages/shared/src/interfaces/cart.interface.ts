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
/** One way to deliver the cart: carrier × pickup point/courier × speed. */
export interface CartDeliveryOptionDto {
  /** "cdek:pvz:STND" — sent back at checkout. */
  key: string;
  carrier: import('./delivery-address.interface').DeliveryCarrier;
  kind: import('./delivery-address.interface').DeliveryKind;
  /** RAKETA tariff code: STND | EXPR | ECON. */
  tariff: string;
  /** «СДЭК · пункт выдачи · Стандарт». */
  title: string;
  /** «Стандарт» / «Экспресс» / «Эконом». */
  speed: string;
  /** Estimated delivery of the whole cart (China → client), ₽. */
  deliveryRub: number;
  /** Days from the China warehouse (null when unknown). */
  daysMin: number | null;
  daysMax: number | null;
}

/** RAKETA extra services sold at cost. */
export type PackagingOption = 'box' | 'crate';
export type PhotoReportOption = 'basic' | 'individual';

/** Prices of the extra services, ₽ (RAKETA charges them with delivery). */
export const EXTRA_SERVICE_PRICES = {
  packaging: { box: 150, crate: 200 } as Record<PackagingOption, number>,
  photoReport: { basic: 150, individual: 250 } as Record<PhotoReportOption, number>,
};

export const PACKAGING_LABELS: Record<PackagingOption, string> = {
  box: 'Дополнительная коробка',
  crate: 'Обрешётка (жёсткий каркас)',
};

export const PHOTO_REPORT_LABELS: Record<PhotoReportOption, string> = {
  basic: 'Фотоотчёт',
  individual: 'Индивидуальный фотоотчёт',
};

export interface CartDeliveryEstimateResponse {
  /** Estimate for the chosen (or default) option. */
  deliveryRub: number;
  /** «Москва» when no address / region is known. */
  hubCity: string;
  /** Ways to deliver to the chosen address (empty for an address without a directory point). */
  options?: CartDeliveryOptionDto[];
  /** Key of the option deliveryRub is for. */
  selectedKey?: string | null;
}

export interface CartResponse {
  id: string;
  items: CartItemDto[];
  summary: CartSummaryDto;
  updatedAt: string;
}
