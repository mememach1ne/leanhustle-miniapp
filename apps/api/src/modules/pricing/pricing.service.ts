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
import { DeliveryEstimationService } from './services/delivery-estimation.service';
import { DutyCalculationService } from './services/duty-calculation.service';
import { ProductCategoryClassifierService } from './services/product-category-classifier.service';

@Injectable()
export class PricingService {
  private readonly settingsService: SettingsService;
  private readonly deliveryEstimationService: DeliveryEstimationService;
  private readonly dutyCalculationService: DutyCalculationService;
  private readonly productCategoryClassifierService: ProductCategoryClassifierService;

  constructor(
    @Inject(SettingsService) settingsService: SettingsService,
    @Inject(DeliveryEstimationService)
    deliveryEstimationService: DeliveryEstimationService,
    @Inject(DutyCalculationService) dutyCalculationService: DutyCalculationService,
    @Inject(ProductCategoryClassifierService)
    productCategoryClassifierService: ProductCategoryClassifierService,
  ) {
    this.settingsService = settingsService;
    this.deliveryEstimationService = deliveryEstimationService;
    this.dutyCalculationService = dutyCalculationService;
    this.productCategoryClassifierService = productCategoryClassifierService;
  }

  async calculateManual(dto: ManualPricingDto): Promise<ManualPricingResult> {
    const settings = await this.settingsService.getCurrentSettings();
    const priceYuan = new Prisma.Decimal(dto.priceYuan);

    const subtotalUsd = priceYuan.mul(settings.cnyToUsd);
    const totalUsd = subtotalUsd
      .mul(new Prisma.Decimal(1).plus(settings.commissionPercent.div(100)))
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
  ): { totalUsd: Prisma.Decimal; deliveryRub: number; dutyRub: number } {
    const subtotalUsd = priceYuan.mul(settings.cnyToUsd);
    const totalUsd = subtotalUsd
      .mul(new Prisma.Decimal(1).plus(settings.commissionPercent.div(100)))
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

  async calculate(dto: CalculatePricingDto): Promise<PricingCalculationResult> {
    const sku = dto.product.skus.find((item) => item.dwSkuId === dto.dwSkuId);

    if (!sku) {
      throw new NotFoundException('Выбранный SKU не найден в карточке товара.');
    }

    if (!sku.isAvailable || sku.priceYuan === null) {
      throw new BadRequestException('Выбранный размер сейчас недоступен для расчёта.');
    }

    const settings = await this.settingsService.getCurrentSettings();
    const priceYuan = new Prisma.Decimal(sku.priceYuan);

    const subtotalUsd = priceYuan.mul(settings.cnyToUsd);
    const totalUsd = subtotalUsd
      .mul(new Prisma.Decimal(1).plus(settings.commissionPercent.div(100)))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const { categoryGroup, deliveryCategory } = this.productCategoryClassifierService.classify({
      title: dto.product.title,
      categoryL1: dto.product.categoryL1,
      categoryL2: dto.product.categoryL2,
      categoryL3: dto.product.categoryL3,
    });

    const { estimatedWeightKg, deliveryRub } = this.deliveryEstimationService.estimateDeliveryRub({
      deliveryCategory,
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
      dwSpuId: dto.product.dwSpuId,
      dwSkuId: sku.dwSkuId,
      size: sku.size,
      version: sku.version,
      priceYuan: Number(priceYuan.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber()),
      totalUsd: totalUsd.toNumber(),
      deliveryRub,
      dutyRub: dutyResult.dutyRub,
      dutyBreakdown: dutyResult.breakdown,
      categoryGroup,
      deliveryCategory,
      estimatedWeightKg,
    };
  }
}
