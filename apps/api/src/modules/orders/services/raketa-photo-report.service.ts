import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { type RaketaOrderDetails, RaketaClientService } from '../../raketa/raketa-client.service';
import { OrderNotificationsService } from './order-notifications.service';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Photo URLs of a photo-report service (the cabinet keeps them as strings in `items`). */
function photoUrls(service: { items?: unknown[] } | undefined): string[] {
  return (service?.items ?? [])
    .map((x) => (typeof x === 'string' ? x : ((x as { url?: string; path?: string } | null)?.url ?? (x as { path?: string } | null)?.path)))
    .filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u));
}

/**
 * RAKETA photographs items with a photo report when they reach the China
 * warehouse. Every 20 min we pick the photos up from the order card, keep
 * them on the item (shown on the order page) and send them to the client
 * once. Hidden orders get the photos stored but not sent.
 */
@Injectable()
export class RaketaPhotoReportService {
  private readonly logger = new Logger(RaketaPhotoReportService.name);
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaketaClientService) private readonly raketa: RaketaClientService,
    @Inject(OrderNotificationsService) private readonly notifications: OrderNotificationsService,
  ) {}

  @Cron('0 */20 * * * *')
  async sync(): Promise<void> {
    if (this.running || !this.raketa.isConfigured) return;
    this.running = true;
    try {
      const items = await this.prisma.orderItem.findMany({
        where: {
          photoReport: { not: null },
          photoReportSentAt: null,
          raketaOrderId: { not: null },
          order: { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.DELIVERED] } },
        },
        include: { order: { select: { id: true, orderNumber: true, hiddenFromClient: true, user: { select: { telegramId: true } } } } },
        orderBy: { createdAt: 'asc' },
      });
      const byRaketaOrder = new Map<string, typeof items>();
      for (const item of items) {
        const id = item.raketaOrderId as string;
        byRaketaOrder.set(id, [...(byRaketaOrder.get(id) ?? []), item]);
      }

      for (const [raketaOrderId, ours] of byRaketaOrder) {
        let details: RaketaOrderDetails;
        try {
          details = await this.raketa.getOrderDetails(raketaOrderId);
        } catch (error) {
          this.logger.warn(`Photo report: RAKETA order ${raketaOrderId} unavailable: ${errorText(error)}`);
          continue;
        }
        const theirs = [...(details.items ?? [])];
        for (const item of ours) {
          // Match our item to the RAKETA one: the only item, or by link (+ price, count).
          const index =
            theirs.length === 1
              ? 0
              : theirs.findIndex(
                  (x) =>
                    x.link === item.dewuLink &&
                    Number(x.price_cn) === Math.round(Number(item.priceYuan)) &&
                    Number(x.count) === item.quantity,
                );
          if (index < 0) continue;
          const [match] = theirs.splice(index, 1);
          const urls = [...new Set((match.additional_services ?? []).flatMap((s) => photoUrls(s)))];
          if (urls.length === 0) continue;
          await this.deliver(item, urls);
        }
      }
    } catch (error) {
      this.logger.warn(`Photo report sync failed: ${errorText(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async deliver(
    item: {
      id: string;
      productTitle: string;
      sizeLabel: string;
      photoReportUrls: Prisma.JsonValue;
      order: { id: string; orderNumber: string; hiddenFromClient: boolean; user: { telegramId: string } | null };
    },
    urls: string[],
  ): Promise<void> {
    const known = JSON.stringify(item.photoReportUrls) === JSON.stringify(urls);
    if (!known) {
      await this.prisma.orderItem.update({ where: { id: item.id }, data: { photoReportUrls: urls } });
    }
    // Hidden order (being fixed) — keep the photos, send later.
    if (item.order.hiddenFromClient || !item.order.user?.telegramId) return;

    const title = item.productTitle.replace(/[<>&]/g, ' ').slice(0, 80);
    const sent = await this.notifications.sendUserPhotos(
      item.order.user.telegramId,
      urls,
      `Фотоотчёт по заказу <b>${item.order.orderNumber}</b>\n${title}, размер ${item.sizeLabel.replace(/[<>&]/g, ' ')}\n\nТовар на складе в Китае.`,
    );
    if (!sent) return;
    await this.notifications.notifyUserText(
      item.order.user.telegramId,
      `Фото товара сохранены на странице заказа <b>${item.order.orderNumber}</b>. Если что-то не так с товаром, напишите менеджеру.`,
      item.order.id,
    );
    await this.prisma.orderItem.update({ where: { id: item.id }, data: { photoReportSentAt: new Date() } });
    this.logger.log(`Photo report of ${item.order.orderNumber} (${urls.length} photos) sent to the client`);
  }
}
