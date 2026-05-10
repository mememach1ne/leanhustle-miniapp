import type { DewuResolvedProduct } from './product.interface';
import { DeliveryCategory } from '../enums/delivery-category.enum';
import { ProductCategoryGroup } from '../enums/product-category-group.enum';

export interface PricingCalculationRequest {
  product: DewuResolvedProduct;
  dwSkuId: string;
}

export interface PricingCalculationResult {
  dwSpuId: string;
  dwSkuId: string;
  size: string;
  version?: string;
  priceYuan: number;
  totalUsd: number;
  deliveryRub: number;
  dutyRub: number;
  categoryGroup: ProductCategoryGroup;
  deliveryCategory: DeliveryCategory;
  estimatedWeightKg: number;
}

export interface ManualPricingRequest {
  priceYuan: number;
  deliveryCategory: DeliveryCategory;
}

export interface ManualPricingResult {
  priceYuan: number;
  totalUsd: number;
  deliveryRub: number;
  dutyRub: number;
  categoryGroup: ProductCategoryGroup;
  deliveryCategory: DeliveryCategory;
  estimatedWeightKg: number;
}

export interface ManagerHelpRequest {
  dewuLink: string;
  size?: string;
  deliveryCategory: DeliveryCategory;
  comment?: string;
}
