import type { StaffOrderDetailsDto } from '@lean-poizon/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { StaffAccount } from '@prisma/client';
import { OrderStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { DewuApiClientService } from '../../products/services/dewu-api-client.service';
import { type RaketaOrder, RaketaClientService } from '../../raketa/raketa-client.service';
import { buildRaketaItemTitle } from '../../raketa/raketa-title';
import { OrdersService } from '../orders.service';

/** RAKETA's seller directory id for "Poizon (Dewu)". */
const RAKETA_POIZON_SELLER_ID = 5;

/** Statuses in which the item has been (or is being) bought on Poizon. */
const REGISTRABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID_AWAITING_PURCHASE,
  OrderStatus.PURCHASED,
  OrderStatus.DELIVERY_PAYMENT_PENDING,
  OrderStatus.DELIVERY_PAID,
  OrderStatus.DUTY_PAYMENT_PENDING,
  OrderStatus.DUTY_PAID,
];

const CHINA_TRACK_RE = /^[A-Za-z0-9]{9,40}$/;
/** RAKETA's own order number, e.g. RA172104132 — links an existing order. */
const RAKETA_NUMBER_RE = /^RA\d{6,}$/;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Stage 1 of the RAKETA automation: once the manager enters the China-side
 * tracking number for an item, register that item as an order in the
 * RAKETA cabinet (title in Russian, Chinese description, price, declarant).
 * Sending a RAKETA number (RA…) instead links an order created by hand.
 */
@Injectable()
export class RaketaFulfillmentService {
  private readonly logger = new Logger(RaketaFulfillmentService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaketaClientService) private readonly raketa: RaketaClientService,
    @Inject(DewuApiClientService) private readonly dewu: DewuApiClientService,
    @Inject(OrdersService) private readonly ordersService: OrdersService,
  ) {}

  async setManual(orderId: string, manual: boolean, staff: StaffAccount): Promise<StaffOrderDetailsDto> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заказ не найден.');

    if (order.fulfillmentManual !== manual) {
      await this.prisma.$transaction([
        this.prisma.order.update({ where: { id: orderId }, data: { fulfillmentManual: manual } }),
        this.prisma.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: order.status,
            changedByStaffId: staff.id,
            comment: manual
              ? 'RAKETA: заказ переведён на ручное оформление.'
              : 'RAKETA: автоматическое оформление включено.',
          },
        }),
      ]);
    }
    return this.ordersService.getOrderForStaff(orderId);
  }

  async registerChinaTrack(
    orderId: string,
    itemId: string,
    rawTrack: string,
    staff: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    const track = rawTrack.replace(/\s+/g, '').toUpperCase();
    if (!CHINA_TRACK_RE.test(track)) {
      throw new BadRequestException(
        'Пришлите китайский трек (латинские буквы и цифры, от 9 символов, например SF1234567890) или номер RAKETA вида RA172104132.',
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Заказ не найден.');
    if (order.fulfillmentManual) {
      throw new BadRequestException('Заказ ведётся вручную — автоматика RAKETA для него выключена.');
    }
    if (!REGISTRABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException('Китайский трек можно ввести только после оплаты товара клиентом.');
    }

    const index = order.items.findIndex((item) => item.id === itemId);
    const item = order.items[index];
    if (!item) throw new NotFoundException('Товар не найден в заказе.');
    if (item.raketaOrderId) {
      throw new BadRequestException(
        `Этот товар уже зарегистрирован в RAKETA (${item.raketaTrackNumber ?? item.raketaOrderId}).`,
      );
    }

    try {
      // "RA…" — the order already exists in RAKETA (created by hand): link it.
      if (RAKETA_NUMBER_RE.test(track)) {
        const found = await this.raketa.findOrderByTrack(track);
        if (!found) throw new Error(`в кабинете не найден заказ ${track}`);
        await this.linkItem(order, item.id, found, staff, 'привязан по номеру RAKETA');
        return this.ordersService.getOrderForStaff(orderId);
      }

      await this.prisma.orderItem.update({ where: { id: item.id }, data: { chinaTrackNumber: track } });

      const ruTitle = buildRaketaItemTitle({
        title: item.productTitle,
        categoryL1: item.categoryL1,
        categoryL2: item.categoryL2,
        categoryL3: item.categoryL3,
      });
      const label = order.items.length > 1 ? `${order.orderNumber}-${index + 1}` : order.orderNumber;

      // Retry-safe: a previous attempt may have created the order already.
      const existing = await this.raketa.findOrderByTrack(track);
      if (existing) {
        await this.linkItem(order, item.id, existing, staff, 'привязан');
        return this.ordersService.getOrderForStaff(orderId);
      }

      let created: RaketaOrder;
      try {
        created = await this.raketa.createOrder({
          title: `${label}) ${ruTitle}`.slice(0, 190),
          china_track_number: track,
          seller_id: RAKETA_POIZON_SELLER_ID,
          declarant_id: await this.raketa.getOwnDeclarantId(),
          items: [
            {
              link: item.dewuLink,
              item_title: ruTitle,
              discription_cn: await this.chineseDescription(item.dwSpuId, item.productTitle, item.sizeLabel),
              count: item.quantity,
              price_cn: Number(item.priceYuan).toFixed(0),
              additional_services: [],
            },
          ],
          additional_services: [],
          delivery_type: null,
          receive_type: null,
          customer_recipient_id: null,
          customer_address_id: null,
          tc_tariff_token: null,
          consolidation_id: null,
          draft: false,
        });
      } catch (error) {
        // RAKETA already has an order with this track (e.g. an earlier attempt
        // whose response we couldn't read) — find it among recent orders.
        if (!/уже создан/i.test(errorText(error))) throw error;
        const found = await this.raketa.scanRecentOrdersForChinaTrack(track);
        if (!found) {
          throw new Error(
            'RAKETA пишет, что заказ с этим треком уже создан, но найти его не удалось — пришлите его номер RAKETA (RA…), и он привяжется.',
          );
        }
        await this.linkItem(order, item.id, found, staff, 'привязан');
        return this.ordersService.getOrderForStaff(orderId);
      }

      await this.linkItem(order, item.id, created, staff, 'создан', `${label}) ${ruTitle}`);
      this.logger.log(`RAKETA order ${created.id} created for ${order.orderNumber} item ${index + 1}`);
    } catch (error) {
      const message = errorText(error);
      this.logger.warn(`RAKETA registration failed for ${order.orderNumber}: ${message}`);
      await this.prisma.order.update({ where: { id: order.id }, data: { raketaLastError: message.slice(0, 1000) } });
      throw new BadRequestException(`RAKETA: не удалось создать заказ — ${message}`);
    }

    return this.ordersService.getOrderForStaff(orderId);
  }

  private async linkItem(
    order: { id: string; status: OrderStatus },
    itemId: string,
    raketaOrder: RaketaOrder,
    staff: StaffAccount,
    verb: string,
    fallbackTitle?: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.orderItem.update({
        where: { id: itemId },
        data: {
          raketaOrderId: raketaOrder.id,
          raketaTrackNumber: raketaOrder.raketa_track_number ?? null,
          ...(raketaOrder.china_track_number ? { chinaTrackNumber: raketaOrder.china_track_number } : {}),
          raketaRegisteredAt: new Date(),
        },
      }),
      this.prisma.order.update({ where: { id: order.id }, data: { raketaLastError: null } }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          changedByStaffId: staff.id,
          comment: `RAKETA: заказ «${raketaOrder.title || fallbackTitle || ''}» ${verb}${
            raketaOrder.raketa_track_number ? ` (${raketaOrder.raketa_track_number})` : ''
          }${raketaOrder.china_track_number ? `, трек Китая ${raketaOrder.china_track_number}` : ''}.`,
        },
      }),
    ]);
  }

  /** Chinese title from the price engine (RAKETA needs a description in Chinese). */
  private async chineseDescription(dwSpuId: string, fallbackTitle: string, size: string): Promise<string> {
    try {
      const raw = await this.dewu.queryProductDetail(dwSpuId);
      const data = (raw as { data?: { titleRaw?: string } }).data;
      if (data?.titleRaw) return `${data.titleRaw} 尺码 ${size}`.slice(0, 500);
    } catch (error) {
      this.logger.warn(`Engine lookup for Chinese title failed (${dwSpuId}): ${String(error)}`);
    }
    return `${fallbackTitle} 尺码 ${size}`.slice(0, 500);
  }
}
