import type { DutyBreakdown } from '@lean-poizon/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface DutyCalculationResult {
  dutyRub: number;
  breakdown?: DutyBreakdown;
}

@Injectable()
export class DutyCalculationService {
  calculateDutyRub(params: {
    priceYuan: Prisma.Decimal;
    cnyToRub: Prisma.Decimal;
    eurToRub: Prisma.Decimal;
    dutyThresholdEur: Prisma.Decimal;
    dutyPercent: Prisma.Decimal;
    dutyProcessingFeeRub: Prisma.Decimal;
  }): number {
    return this.calculate(params).dutyRub;
  }

  calculate(params: {
    priceYuan: Prisma.Decimal;
    cnyToRub: Prisma.Decimal;
    eurToRub: Prisma.Decimal;
    dutyThresholdEur: Prisma.Decimal;
    dutyPercent: Prisma.Decimal;
    dutyProcessingFeeRub: Prisma.Decimal;
  }): DutyCalculationResult {
    const priceRub = params.priceYuan.mul(params.cnyToRub);
    const priceEur = priceRub.div(params.eurToRub);

    if (priceEur.lte(params.dutyThresholdEur)) {
      return { dutyRub: 0 };
    }

    const excessEur = priceEur.minus(params.dutyThresholdEur);
    const dutyEur = excessEur.mul(params.dutyPercent).div(100);
    const dutyAmountRub = dutyEur.mul(params.eurToRub);
    const totalRubDecimal = dutyAmountRub
      .plus(params.dutyProcessingFeeRub)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

    return {
      dutyRub: totalRubDecimal.toNumber(),
      breakdown: {
        priceEur: Number(priceEur.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber()),
        thresholdEur: Number(params.dutyThresholdEur.toNumber()),
        excessEur: Number(excessEur.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber()),
        dutyPercent: Number(params.dutyPercent.toNumber()),
        dutyAmountRub: Number(
          dutyAmountRub.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber(),
        ),
        processingFeeRub: Number(params.dutyProcessingFeeRub.toNumber()),
        totalRub: totalRubDecimal.toNumber(),
      },
    };
  }
}
