import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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
    const priceRub = params.priceYuan.mul(params.cnyToRub);
    const priceEur = priceRub.div(params.eurToRub);

    if (priceEur.lte(params.dutyThresholdEur)) {
      return 0;
    }

    const excessEur = priceEur.minus(params.dutyThresholdEur);
    const dutyEur = excessEur.mul(params.dutyPercent).div(100);
    const dutyRub = dutyEur
      .mul(params.eurToRub)
      .plus(params.dutyProcessingFeeRub)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

    return dutyRub.toNumber();
  }
}
