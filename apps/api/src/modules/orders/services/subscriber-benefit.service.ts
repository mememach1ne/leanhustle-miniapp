import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

type BenefitOrder = {
  id: string;
  userId: string;
  status: OrderStatus;
  isChannelSubscriberAtCheckout: boolean;
  subscriberBenefitApplied: boolean;
  totalUsd: Prisma.Decimal;
  pricingCnyToUsd: Prisma.Decimal;
  pricingCnyToRub: Prisma.Decimal;
  user: {
    id: string;
    isChannelSubscriber: boolean;
    hasUsedSubscriberBenefit: boolean;
  };
  items: Array<{
    id: string;
    priceYuan: Prisma.Decimal;
    originalTotalUsd: Prisma.Decimal;
    totalUsd: Prisma.Decimal;
  }>;
};

export interface SubscriberBenefitApplicationResult {
  applied: boolean;
  benefitDiscountUsd: Prisma.Decimal;
  benefitDiscountRub: Prisma.Decimal;
  adjustedTotalUsd: Prisma.Decimal;
}

@Injectable()
export class SubscriberBenefitService {
  async applyIfEligible(
    prisma: Prisma.TransactionClient,
    order: BenefitOrder,
  ): Promise<SubscriberBenefitApplicationResult> {
    const notYetUsed =
      !order.subscriberBenefitApplied && !order.user.hasUsedSubscriberBenefit;
    const isEligibleSubscriber =
      order.user.isChannelSubscriber || order.isChannelSubscriberAtCheckout;

    if (!notYetUsed || !isEligibleSubscriber) {
      return this.buildNoopResult(order);
    }

    const usdToRub = order.pricingCnyToRub.div(order.pricingCnyToUsd);

    const itemUpdates = order.items.map((item) => {
      const subtotalUsd = item.priceYuan
        .mul(order.pricingCnyToUsd)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const originalTotalUsd = item.originalTotalUsd;
      const benefitDiscountUsd = Prisma.Decimal.max(
        originalTotalUsd.sub(subtotalUsd),
        new Prisma.Decimal(0),
      ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const adjustedTotalUsd = originalTotalUsd
        .sub(benefitDiscountUsd)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      return {
        itemId: item.id,
        adjustedTotalUsd,
        benefitDiscountUsd,
      };
    });

    const benefitDiscountUsd = itemUpdates.reduce(
      (sum, item) => sum.add(item.benefitDiscountUsd),
      new Prisma.Decimal(0),
    );

    if (benefitDiscountUsd.lte(0)) {
      return this.buildNoopResult(order);
    }

    const adjustedTotalUsd = itemUpdates.reduce(
      (sum, item) => sum.add(item.adjustedTotalUsd),
      new Prisma.Decimal(0),
    );
    const benefitDiscountRub = benefitDiscountUsd
      .mul(usdToRub)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const userUpdateResult = await prisma.user.updateMany({
      where: {
        id: order.userId,
        hasUsedSubscriberBenefit: false,
      },
      data: {
        hasUsedSubscriberBenefit: true,
      },
    });

    if (userUpdateResult.count === 0) {
      return this.buildNoopResult(order);
    }

    await Promise.all(
      itemUpdates.map((item) =>
        prisma.orderItem.update({
          where: { id: item.itemId },
          data: {
            totalUsd: item.adjustedTotalUsd,
          },
        }),
      ),
    );

    await prisma.order.update({
      where: { id: order.id },
      data: {
        totalUsd: adjustedTotalUsd,
        subscriberBenefitApplied: true,
        subscriberBenefitAmountRub: benefitDiscountRub,
        benefitDiscountUsd,
      },
    });

    return {
      applied: true,
      benefitDiscountUsd,
      benefitDiscountRub,
      adjustedTotalUsd,
    };
  }

  private buildNoopResult(order: BenefitOrder): SubscriberBenefitApplicationResult {
    return {
      applied: false,
      benefitDiscountUsd: new Prisma.Decimal(0),
      benefitDiscountRub: new Prisma.Decimal(0),
      adjustedTotalUsd: order.totalUsd ?? order.items.reduce(
        (sum, item) => sum.add(item.totalUsd),
        new Prisma.Decimal(0),
      ),
    };
  }
}
