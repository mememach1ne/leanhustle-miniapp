import { ORDER_NUMBER_PREFIX } from '@lean-poizon/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrderNumberService {
  async generate(
    prisma: Prisma.TransactionClient,
    isChannelSubscriber: boolean,
  ): Promise<string> {
    const prefix = isChannelSubscriber
      ? ORDER_NUMBER_PREFIX.SUBSCRIBER
      : ORDER_NUMBER_PREFIX.REGULAR;

    const sequence = await prisma.orderSequence.upsert({
      where: { prefix },
      update: {
        lastValue: {
          increment: 1,
        },
      },
      create: {
        prefix,
        lastValue: 1,
      },
    });

    return `${prefix}${String(sequence.lastValue).padStart(3, '0')}`;
  }
}
