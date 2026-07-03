import type { ManualPricingResult, PricingCalculationResult } from '@lean-poizon/shared';
import { DeliveryCategory, getCategoryGroupFromDeliveryCategory } from '@lean-poizon/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { SettingsService } from '../settings/settings.service';
import { CalculatePricingDto } from './dto/calculate-pricing.dto';
import { ManualPricingDto } from './dto/manual-pricing.dto';
import {
  DeliveryCategoryWeightService,
} from './services/delivery-category-weight.service';
import { DeliveryEstimationService } from './services/delivery-estimation.service';
import { DutyCalculationService } from './services/duty-calculation.service';
import { ProductCategoryClassifierService } from './services/product-category-classifier.service';

interface ResolvedDeliveryInfo {
  deliveryCategory: DeliveryCategory;
  estimatedWeightKg: number;
  deliveryRub: number;
  /** True when no weight is known yet — caller should treat delivery as unknown. */
  weightPending: boolean;
}

@Injectable()
export class PricingService {
  private readonly settingsService: SettingsService;
  private readonly deliveryEstimationService: DeliveryEstimationService;
  private readonly dutyCalculationService: DutyCalculationService;
  private readonly productCategoryClassifierService: ProductCategoryClassifierService;
  private readonly categoryWeightService: DeliveryCategoryWeightService;

  constructor(
    @Inject(SettingsService) settingsService: SettingsService,
    @Inject(DeliveryEstimationService)
    deliveryEstimationService: DeliveryEstimationService,
    @Inject(DutyCalculationService) dutyCalculationService: DutyCalculationService,
    @Inject(ProductCategoryClassifierService)
    productCategoryClassifierService: ProductCategoryClassifierService,
    @Inject(DeliveryCategoryWeightService)
    categoryWeightService: DeliveryCategoryWeightService,
  ) {
    this.settingsService = settingsService;
    this.deliveryEstimationService = deliveryEstimationService;
    this.dutyCalculationService = dutyCalculationService;
    this.productCategoryClassifierService = productCategoryClassifierService;
    this.categoryWeightService = categoryWeightService;
  }

  /**
   * Pick the appropriate delivery weight + cost for a product. The lookup
   * order is:
   *   1. Manager-set weight in DB for the exact L1>L2>L3 chain (overrides
   *      everything) — applies even to known enum categories so managers
   *      can fine-tune specific subcategories.
   *   2. Keyword classifier — picks one of the hardcoded enum values
   *      (SNEAKERS, JACKET, etc.) by matching the title/categories.
   *   3. GENERIC_APPAREL fallback → mark as pending (no estimate).
   */
  async resolveDelivery(input: {
    title: string;
    categoryL1?: string | null;
    categoryL2?: string | null;
    categoryL3?: string | null;
    deliveryPricePerKgRub: Prisma.Decimal;
  }): Promise<ResolvedDeliveryInfo> {
    // Step 1: explicit DB override for this chain.
    const dbLookup = await this.categoryWeightService.lookup(
      input.categoryL1,
      input.categoryL2,
      input.categoryL3,
    );

    if (dbLookup) {
      if (typeof dbLookup.weightKg === 'number') {
        const deliveryRub = new Prisma.Decimal(dbLookup.weightKg)
          .mul(input.deliveryPricePerKgRub)
          .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
          .toNumber();
        return {
          deliveryCategory: DeliveryCategory.GENERIC_APPAREL,
          estimatedWeightKg: dbLookup.weightKg,
          deliveryRub,
          weightPending: false,
        };
      }
      if (dbLookup.weightKg === null) {
        // Row exists but weight isn't set yet.
        return {
          deliveryCategory: DeliveryCategory.OTHER,
          estimatedWeightKg: 0,
          deliveryRub: 0,
          weightPending: true,
        };
      }
    }

    // Step 2: keyword classifier on title + categories.
    const { deliveryCategory } = this.productCategoryClassifierService.classify({
      title: input.title,
      categoryL1: input.categoryL1 ?? undefined,
      categoryL2: input.categoryL2 ?? undefined,
      categoryL3: input.categoryL3 ?? undefined,
    });

    if (deliveryCategory === DeliveryCategory.GENERIC_APPAREL) {
      // Classifier fell back — we can't trust the weight. Mark pending.
      return {
        deliveryCategory: DeliveryCategory.OTHER,
        estimatedWeightKg: 0,
        deliveryRub: 0,
        weightPending: true,
      };
    }

    // Step 3: known enum category. Prefer manager-overridden weight from
    // DB (so they can fine-tune e.g. "boots" without code changes), fall
    // back to the hardcoded one.
    const dbOverride = await this.categoryWeightService.lookupByEnumKey(deliveryCategory);

    if (dbOverride === null) {
      // Manager explicitly cleared the weight — treat as pending.
      return {
        deliveryCategory: DeliveryCategory.OTHER,
        estimatedWeightKg: 0,
        deliveryRub: 0,
        weightPending: true,
      };
    }

    if (typeof dbOverride === 'number') {
      const deliveryRub = new Prisma.Decimal(dbOverride)
        .mul(input.deliveryPricePerKgRub)
        .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
        .toNumber();
      return {
        deliveryCategory,
        estimatedWeightKg: dbOverride,
        deliveryRub,
        weightPending: false,
      };
    }

    // Fallback to hardcoded weight (DB not seeded yet).
    const { estimatedWeightKg, deliveryRub } =
      this.deliveryEstimationService.estimateDeliveryRub({
        deliveryCategory,
        deliveryPricePerKgRub: input.deliveryPricePerKgRub,
      });

    return {
      deliveryCategory,
      estimatedWeightKg,
      deliveryRub,
      weightPending: false,
    };
  }

  /**
   * Commission left after subtracting the customer's loyalty discount
   * (in percentage points), floored at 0.
   */
  effectiveCommissionPercent(
    commissionPercent: Prisma.Decimal,
    discountPercentPoints = 0,
  ): Prisma.Decimal {
    if (!discountPercentPoints || discountPercentPoints <= 0) {
      return commissionPercent;
    }

    const discounted = commissionPercent.minus(discountPercentPoints);
    return discounted.greaterThan(0) ? discounted : new Prisma.Decimal(0);
  }

  async calculateManual(
    dto: ManualPricingDto,
    discountPercentPoints = 0,
  ): Promise<ManualPricingResult> {
    const settings = await this.settingsService.getCurrentSettings();
    const priceYuan = new Prisma.Decimal(dto.priceYuan);
    const commissionPercent = this.effectiveCommissionPercent(
      settings.commissionPercent,
      discountPercentPoints,
    );

    const subtotalUsd = priceYuan.mul(settings.cnyToUsd);
    const totalUsd = subtotalUsd
      .mul(new Prisma.Decimal(1).plus(commissionPercent.div(100)))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const categoryGroup = getCategoryGroupFromDeliveryCategory(dto.deliveryCategory);

    const { estimatedWeightKg, deliveryRub } = this.deliveryEstimationService.estimateDeliveryRub({
      deliveryCategory: dto.deliveryCategory,
      deliveryPricePerKgRub: settings.deliveryPricePerKgRub,
    });

    const dutyResult = this.dutyCalculationService.calculate({
      priceYuan,
      cnyToRub: settings.cnyToRub,
      eurToRub: settings.eurToRub,
      dutyThresholdEur: settings.dutyThresholdEur,
      dutyPercent: settings.dutyPercent,
      dutyProcessingFeeRub: settings.dutyProcessingFeeRub,
    });

    return {
      priceYuan: Number(priceYuan.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber()),
      totalUsd: totalUsd.toNumber(),
      deliveryRub,
      dutyRub: dutyResult.dutyRub,
      dutyBreakdown: dutyResult.breakdown,
      categoryGroup,
      deliveryCategory: dto.deliveryCategory,
      estimatedWeightKg,
    };
  }

  recalculateFromYuan(
    priceYuan: Prisma.Decimal,
    deliveryCategory: string,
    settings: {
      cnyToUsd: Prisma.Decimal;
      cnyToRub: Prisma.Decimal;
      eurToRub: Prisma.Decimal;
      commissionPercent: Prisma.Decimal;
      deliveryPricePerKgRub: Prisma.Decimal;
      dutyThresholdEur: Prisma.Decimal;
      dutyPercent: Prisma.Decimal;
      dutyProcessingFeeRub: Prisma.Decimal;
    },
    discountPercentPoints = 0,
  ): { totalUsd: Prisma.Decimal; deliveryRub: number; dutyRub: number } {
    const commissionPercent = this.effectiveCommissionPercent(
      settings.commissionPercent,
      discountPercentPoints,
    );
    const subtotalUsd = priceYuan.mul(settings.cnyToUsd);
    const totalUsd = subtotalUsd
      .mul(new Prisma.Decimal(1).plus(commissionPercent.div(100)))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const { deliveryRub } = this.deliveryEstimationService.estimateDeliveryRub({
      deliveryCategory: deliveryCategory as DeliveryCategory,
      deliveryPricePerKgRub: settings.deliveryPricePerKgRub,
    });

    const dutyRub = this.dutyCalculationService.calculateDutyRub({
      priceYuan,
      cnyToRub: settings.cnyToRub,
      eurToRub: settings.eurToRub,
      dutyThresholdEur: settings.dutyThresholdEur,
      dutyPercent: settings.dutyPercent,
      dutyProcessingFeeRub: settings.dutyProcessingFeeRub,
    });

    return { totalUsd, deliveryRub, dutyRub };
  }

  async calculate(
    dto: CalculatePricingDto,
    discountPercentPoints = 0,
  ): Promise<PricingCalculationResult> {
    const sku = dto.product.skus.find((item) => item.dwSkuId === dto.dwSkuId);

    if (!sku) {
      throw new NotFoundException('Выбранный SKU не найден в карточке товара.');
    }

    if (!sku.isAvailable || sku.priceYuan === null) {
      throw new BadRequestException('Выбранный размер сейчас недоступен для расчёта.');
    }

    const settings = await this.settingsService.getCurrentSettings();
    const priceYuan = new Prisma.Decimal(sku.priceYuan);
    const commissionPercent = this.effectiveCommissionPercent(
      settings.commissionPercent,
      discountPercentPoints,
    );

    const subtotalUsd = priceYuan.mul(settings.cnyToUsd);
    const totalUsd = subtotalUsd
      .mul(new Prisma.Decimal(1).plus(commissionPercent.div(100)))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const delivery = await this.resolveDelivery({
      title: dto.product.title,
      categoryL1: dto.product.categoryL1,
      categoryL2: dto.product.categoryL2,
      categoryL3: dto.product.categoryL3,
      deliveryPricePerKgRub: settings.deliveryPricePerKgRub,
    });

    const categoryGroup = getCategoryGroupFromDeliveryCategory(delivery.deliveryCategory);

    const dutyResult = this.dutyCalculationService.calculate({
      priceYuan,
      cnyToRub: settings.cnyToRub,
      eurToRub: settings.eurToRub,
      dutyThresholdEur: settings.dutyThresholdEur,
      dutyPercent: settings.dutyPercent,
      dutyProcessingFeeRub: settings.dutyProcessingFeeRub,
    });

    return {
      dwSpuId: dto.product.dwSpuId,
      dwSkuId: sku.dwSkuId,
      size: sku.size,
      version: sku.version,
      priceYuan: Number(priceYuan.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber()),
      totalUsd: totalUsd.toNumber(),
      deliveryRub: delivery.deliveryRub,
      dutyRub: dutyResult.dutyRub,
      dutyBreakdown: dutyResult.breakdown,
      categoryGroup,
      deliveryCategory: delivery.deliveryCategory,
      estimatedWeightKg: delivery.estimatedWeightKg,
      weightPending: delivery.weightPending,
    };
  }
}
