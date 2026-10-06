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
import { RaketaClientService } from '../../raketa/raketa-client.service';
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

/**
 * Stage 1 of the RAKETA automation: once the manager enters the China-side
 * tracking number for an item, register that item as an order in the
 * RAKETA cabinet (title in Russian, Chinese description, price, declarant).
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
    const chinaTrack = rawTrack.replace(/\s+/g, '').toUpperCase();
    if (!CHINA_TRACK_RE.test(chinaTrack)) {
      throw new BadRequestException(
        'Китайский трек должен состоять только из латинских букв и цифр, минимум 9 символов (например SF1234567890).',
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
      throw new BadRequestException(`Этот товар уже зарегистрирован в RAKETA (${item.raketaTrackNumber ?? item.raketaOrderId}).`);
    }

    await this.prisma.orderItem.update({ where: { id: item.id }, data: { chinaTrackNumber: chinaTrack } });

    const ruTitle = buildRaketaItemTitle({
      title: item.productTitle,
      categoryL1: item.categoryL1,
      categoryL2: item.categoryL2,
      categoryL3: item.categoryL3,
    });
    const label = order.items.length > 1 ? `${order.orderNumber}-${index + 1}` : order.orderNumber;

    try {
      // Retry-safe: a previous attempt may have created the order already.
      const existing = await this.raketa.findOrderByChinaTrack(chinaTrack);
      const created = existing ?? await this.raketa.createOrder({
        title: `${label}) ${ruTitle}`.slice(0, 190),
        china_track_number: chinaTrack,
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

      await this.prisma.$transaction([
        this.prisma.orderItem.update({
          where: { id: item.id },
          data: {
            raketaOrderId: created.id,
            raketaTrackNumber: created.raketa_track_number ?? null,
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
            comment: `RAKETA: заказ «${existing ? existing.title : `${label}) ${ruTitle}`}» ${existing ? 'привязан' : 'создан'}${
              created.raketa_track_number ? ` (${created.raketa_track_number})` : ''
            }, трек Китая ${chinaTrack}.`,
          },
        }),
      ]);
      this.logger.log(`RAKETA order ${created.id} created for ${order.orderNumber} item ${index + 1}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`RAKETA registration failed for ${order.orderNumber}: ${message}`);
      await this.prisma.order.update({ where: { id: order.id }, data: { raketaLastError: message.slice(0, 1000) } });
      throw new BadRequestException(`RAKETA: не удалось создать заказ — ${message}`);
    }

    return this.ordersService.getOrderForStaff(orderId);
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
