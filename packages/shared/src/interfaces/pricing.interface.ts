import type { DewuResolvedProduct } from './product.interface';
import { DeliveryCategory } from '../enums/delivery-category.enum';
import { ProductCategoryGroup } from '../enums/product-category-group.enum';

export interface PricingCalculationRequest {
  product: DewuResolvedProduct;
  dwSkuId: string;
}

export interface DutyBreakdown {
  priceEur: number;
  thresholdEur: number;
  excessEur: number;
  dutyPercent: number;
  dutyAmountRub: number;
  processingFeeRub: number;
  totalRub: number;
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
  dutyBreakdown?: DutyBreakdown;
  categoryGroup: ProductCategoryGroup;
  deliveryCategory: DeliveryCategory;
  estimatedWeightKg: number;
  /**
   * True when the product matched a Poizon L1/L2/L3 chain that we don't yet
   * have a weight for in the dynamic delivery-category table. Frontend uses
   * this to show "вес уточнит менеджер" instead of a misleading estimate.
   */
  weightPending?: boolean;
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
  dutyBreakdown?: DutyBreakdown;
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

export interface DeliveryCategoryWeightDto {
  id: string;
  categoryKey: string;
  categoryL1: string | null;
  categoryL2: string | null;
  categoryL3: string | null;
  title: string;
  /** null = no weight set yet (pending) */
  weightKg: number | null;
  encounterCount: number;
  firstSeenAt: string;
  updatedAt: string;
}

export interface SetCategoryWeightRequest {
  weightKg: number;
}

// ===== Admin analytics =====

export interface AdminAnalyticsActivityPoint {
  /** Bucket start in ISO 8601 (UTC). */
  bucket: string;
  activeUsers: number;
}

export interface AdminAnalyticsResponse {
  /** Active in the last 5 minutes. */
  onlineNow: number;
  /** Active in the last 30 minutes. */
  online30m: number;
  /** Daily Active Users (last 24 hours). */
  dau: number;
  /** Weekly Active Users (last 7 days). */
  wau: number;
  /** Monthly Active Users (last 30 days). */
  mau: number;
  /** Total registered users. */
  totalUsers: number;
  /** New users registered in last 24 hours. */
  newToday: number;
  /** Hourly activity for the last 24h (24 points). */
  hourly: AdminAnalyticsActivityPoint[];
  /** Daily activity for the last 30 days (30 points). */
  daily: AdminAnalyticsActivityPoint[];
}
