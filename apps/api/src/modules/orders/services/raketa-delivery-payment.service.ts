import { OrderStatus as SharedOrderStatus } from '@lean-poizon/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  parseMoney,
  RAKETA_STAGE_AT_WAREHOUSE,
  type RaketaBillingRow,
  RaketaClientService,
  type RaketaPrice,
} from '../../raketa/raketa-client.service';
import { OrderNotificationsService } from './order-notifications.service';

/** A ready-made top-up link is reused for this long, then a fresh one is made. */
const TOPUP_LINK_TTL_MS = 6 * 60 * 60 * 1000;
const RAKETA_DUTY_LINE_ID = 'customs_duty';
/** Sanity cap: a delivery bill above this is surely a parsing error — never sent to a client. */
const MAX_CLIENT_AMOUNT_RUB = 50_000;

/** Goods are bought — delivery can be asked for. */
const ASK_DELIVERY_STATUSES: OrderStatus[] = [OrderStatus.PAID_AWAITING_PURCHASE, OrderStatus.PURCHASED];

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const rub = (value: number) => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;

export interface RaketaPriceLineView {
  id: string | null;
  name: string;
  amountRub: number;
}

/** Lines the client pays for: international + RF delivery, duty, insurance and other services (no discounts). */
export function chargeableLines(price: RaketaPrice): RaketaPriceLineView[] {
  return [...(price.price ?? []), ...(price.services ?? [])]
    .map((line) => ({
      id: line.id ? String(line.id) : null,
      name: String(line.name ?? '').trim(),
      amountRub: parseMoney(line.sum) ?? 0,
    }))
    .filter((line) => line.name && line.amountRub > 0);
}

type CycleOrder = Prisma.OrderGetPayload<{
  include: { items: { select: { raketaOrderId: true } }; user: { select: { telegramId: true } } };
}>;

/**
 * Stage 4 of the RAKETA automation — after the parcels reach the warehouse:
 *   1. every order of a consolidation is «На складе в Китае» → press «Собрать»;
 *   2. RAKETA packs and weighs it (usually 4–6 h) and shows the price;
 *   3. the client gets a RAKETA balance top-up link for exactly that price
 *      (international + RF delivery + duty + insurance);
 *   4. the top-up shows up in RAKETA's billing history → the server pays the
 *      consolidation / order from the balance and the parcel leaves China.
 * Runs every 10 minutes; consolidations not tied to our orders get steps 1–2
 * plus a price notice to the managers.
 */
@Injectable()
export class RaketaDeliveryPaymentService {
  private readonly logger = new Logger(RaketaDeliveryPaymentService.name);
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaketaClientService) private readonly raketa: RaketaClientService,
    @Inject(OrderNotificationsService) private readonly notifications: OrderNotificationsService,
  ) {}

  @Cron('0 */10 * * * *')
  async runCycle(): Promise<void> {
    if (this.running || !this.raketa.isConfigured) return;
    this.running = true;
    try {
      await this.assembleConsolidations();
      await this.processOrders();
    } catch (error) {
      this.logger.warn(`RAKETA delivery cycle failed: ${errorText(error)}`);
    } finally {
      this.running = false;
    }
  }

  /** Client asks for the payment link (site / Mini App «Оплатить доставку»). */
  async getPaymentLinkForUser(userId: string, orderId: string): Promise<{ url: string; amountRub: number }> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Заказ не найден.');
    if (order.status !== OrderStatus.DELIVERY_PAYMENT_PENDING || !order.raketaTopupAmount) {
      throw new BadRequestException('Для этого заказа сейчас нечего оплачивать.');
    }
    const amountRub = Number(order.raketaTopupAmount);
    const fresh =
      order.raketaTopupUrl &&
      order.raketaTopupCreatedAt &&
      Date.now() - order.raketaTopupCreatedAt.getTime() < TOPUP_LINK_TTL_MS;
    if (fresh) return { url: order.raketaTopupUrl as string, amountRub };

    try {
      const url = await this.raketa.createTopUp(amountRub);
      await this.prisma.order.update({
        where: { id: order.id },
        data: { raketaTopupUrl: url, raketaTopupCreatedAt: new Date() },
      });
      return { url, amountRub };
    } catch (error) {
      this.logger.warn(`Top-up link for ${order.orderNumber} failed: ${errorText(error)}`);
      throw new BadRequestException('Не удалось получить ссылку на оплату. Попробуйте позже или напишите менеджеру.');
    }
  }

  // ------------------------------------------------------------------
  // Step 1: «Собрать»
  // ------------------------------------------------------------------

  private async assembleConsolidations(): Promise<void> {
    const list = await this.raketa.listUnpaidConsolidations();
    for (const item of list) {
      try {
        const record = await this.prisma.raketaConsolidation.upsert({
          where: { id: item.id },
          create: { id: item.id, title: item.title?.slice(0, 255) ?? null },
          update: {},
        });
        const linkedOrder = await this.prisma.order.findFirst({
          where: { raketaConsolidationId: item.id },
          select: { id: true, orderNumber: true, fulfillmentManual: true },
        });
        if (linkedOrder?.fulfillmentManual) continue;

        if (!record.assembledAt) {
          const consolidation = await this.raketa.getConsolidation(item.id);
          const orders = consolidation.orders ?? [];
          const allArrived = orders.length > 0 && orders.every((o) => o.stage_name === RAKETA_STAGE_AT_WAREHOUSE);
          if (consolidation.controls?.consolidation_close && allArrived) {
            await this.assemble(item.id, consolidation.title ?? record.title ?? item.id, orders.length, linkedOrder);
            continue;
          }
          // Not ready yet — or already assembled by hand (then it has a price).
          const price = await this.raketa.getPrice('consolidation', item.id);
          if (!price.controls?.pay_button) continue;
          await this.prisma.raketaConsolidation.update({ where: { id: item.id }, data: { assembledAt: new Date() } });
        }

        // Consolidations outside our orders: just tell the managers the price.
        if (!linkedOrder && !record.priceNotifiedAt) {
          const price = await this.raketa.getPrice('consolidation', item.id);
          const total = parseMoney(price.total);
          if (!price.controls?.pay_button || total === null) continue;
          await this.prisma.raketaConsolidation.update({
            where: { id: item.id },
            data: { priceNotifiedAt: new Date() },
          });
          await this.notifications.notifyManagers(
            [
              `RAKETA: объединение «${record.title ?? item.id}» собрано, к оплате ${rub(total)}.`,
              ...chargeableLines(price).map((line) => `${line.name}: ${rub(line.amountRub)}`),
              'Оно не привязано к заказу клиента — оплатите в кабинете RAKETA.',
            ].join('\n'),
          );
        }
      } catch (error) {
        this.logger.warn(`RAKETA consolidation ${item.id}: ${errorText(error)}`);
      }
    }
  }

  private async assemble(
    consolidationId: string,
    title: string,
    ordersCount: number,
    linkedOrder: { id: string; orderNumber: string } | null,
  ): Promise<void> {
    await this.raketa.closeConsolidation(consolidationId);
    await this.prisma.raketaConsolidation.update({
      where: { id: consolidationId },
      data: { assembledAt: new Date(), title: title.slice(0, 255) },
    });
    if (linkedOrder) {
      await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.update({
          where: { id: linkedOrder.id },
          data: { raketaAssembledAt: new Date() },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: order.status,
            comment: `RAKETA: все ${ordersCount} вещи на складе — объединение отправлено на сборку.`,
          },
        });
      });
    }
    this.logger.log(`RAKETA consolidation ${consolidationId} sent to assembly`);
    await this.notifications.notifyManagers(
      [
        `RAKETA: объединение «${title}»${linkedOrder ? ` (${linkedOrder.orderNumber})` : ''} — все ${ordersCount} вещи на складе, нажал «Собрать».`,
        'Цена доставки появится после упаковки (обычно 4–6 часов).',
      ].join('\n'),
      linkedOrder?.id,
    );
  }

  // ------------------------------------------------------------------
  // Steps 2–4 for our orders
  // ------------------------------------------------------------------

  private async processOrders(): Promise<void> {
    const orders = await this.prisma.order.findMany({
      where: {
        raketaDeliveryAssignedAt: { not: null },
        fulfillmentManual: false,
        raketaPaidAt: null,
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.DELIVERED, OrderStatus.CREATED] },
      },
      include: { items: { select: { raketaOrderId: true } }, user: { select: { telegramId: true } } },
    });
    if (orders.length === 0) return;

    let topUps: RaketaBillingRow[] | null = null;
    const loadTopUps = async () => (topUps ??= await this.raketa.listTopUps());

    for (const order of orders) {
      try {
        await this.processOrder(order, loadTopUps);
      } catch (error) {
        this.logger.warn(`RAKETA delivery step for ${order.orderNumber}: ${errorText(error)}`);
      }
    }
  }

  private async processOrder(order: CycleOrder, loadTopUps: () => Promise<RaketaBillingRow[]>): Promise<void> {
    const target = this.paymentTarget(order);
    if (!target) return;

    // Client paid the top-up (or a manager confirmed payment) → pay RAKETA.
    if (order.deliveryPaidAt && order.raketaPriceTotal) {
      await this.payRaketa(order, target);
      return;
    }

    if (order.status === OrderStatus.DELIVERY_PAYMENT_PENDING && order.raketaTopupAmount) {
      await this.checkTopUp(order, target, await loadTopUps());
      return;
    }

    const price = await this.raketa.getPrice(target.kind, target.id);
    if (price.controls?.paid_button) {
      // Paid by hand in the cabinet.
      await this.prisma.order.update({ where: { id: order.id }, data: { raketaPaidAt: new Date() } });
      return;
    }
    const total = parseMoney(price.total);
    if (!price.controls?.pay_button || total === null) return;

    const lines = chargeableLines(price);
    const isNew = !order.raketaPriceTotal;
    if (isNew) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          raketaPriceTotal: new Prisma.Decimal(total),
          raketaPriceLines: lines as unknown as Prisma.InputJsonValue,
          raketaPriceAt: new Date(),
        },
      });
    }

    if (!order.userId) {
      if (isNew) {
        await this.notifications.notifyManagers(
          [
            `RAKETA: цена доставки по заказу ${order.orderNumber} — ${rub(total)}.`,
            ...lines.map((line) => `${line.name}: ${rub(line.amountRub)}`),
            order.claimToken
              ? 'Клиент ещё не привязал заказ по ссылке — ссылку на оплату доставки отправлю, когда привяжет и оплатит товар.'
              : 'Заказ без клиента — оплатите в кабинете RAKETA.',
          ].join('\n'),
          order.id,
        );
      }
      return;
    }

    if (ASK_DELIVERY_STATUSES.includes(order.status)) {
      await this.requestClientPayment(order, lines);
    }
  }

  private paymentTarget(order: CycleOrder): { kind: 'consolidation' | 'order'; id: string } | null {
    if (order.raketaConsolidationId) return { kind: 'consolidation', id: order.raketaConsolidationId };
    if (order.items.length === 1 && order.items[0].raketaOrderId) {
      return { kind: 'order', id: order.items[0].raketaOrderId };
    }
    return null;
  }

  private async requestClientPayment(order: CycleOrder, lines: RaketaPriceLineView[]): Promise<void> {
    let amount = Math.ceil(lines.reduce((sum, line) => sum + line.amountRub, 0));
    if (amount <= 0) return;
    if (amount > MAX_CLIENT_AMOUNT_RUB) {
      const message = `RAKETA: подозрительная сумма доставки ${rub(amount)} — ссылка клиенту не отправлена, проверьте цену в кабинете.`;
      if (order.raketaLastError !== message) {
        await this.prisma.order.update({ where: { id: order.id }, data: { raketaLastError: message } });
        await this.notifications.notifyManagers(`${message}
Заказ ${order.orderNumber}.`, order.id);
      }
      return;
    }
    const duty = Math.ceil(
      lines.filter((line) => line.id === RAKETA_DUTY_LINE_ID).reduce((sum, line) => sum + line.amountRub, 0),
    );

    // Payments are matched by amount, so two open links must never share one.
    for (;;) {
      const clash = await this.prisma.order.findFirst({
        where: {
          id: { not: order.id },
          status: OrderStatus.DELIVERY_PAYMENT_PENDING,
          raketaTopupAmount: new Prisma.Decimal(amount),
          raketaTopupBillingId: null,
        },
        select: { id: true },
      });
      if (!clash) break;
      amount += 1;
    }

    const seenIds = (await this.raketa.listTopUps()).map((row) => row.id);
    const url = await this.raketa.createTopUp(amount);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.DELIVERY_PAYMENT_PENDING,
          purchasedAt: order.purchasedAt ?? now,
          actualDeliveryRub: new Prisma.Decimal(amount - duty),
          actualDeliverySetAt: now,
          ...(duty > 0 ? { actualDutyRub: new Prisma.Decimal(duty), actualDutySetAt: now } : {}),
          raketaTopupAmount: new Prisma.Decimal(amount),
          raketaTopupUrl: url,
          raketaTopupCreatedAt: now,
          raketaTopupSeenIds: seenIds,
          raketaLastError: null,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.DELIVERY_PAYMENT_PENDING,
          comment: `RAKETA: к оплате ${rub(amount)} (${lines.map((l) => `${l.name} ${rub(l.amountRub)}`).join(', ')}). Клиенту отправлена ссылка на оплату.`,
        },
      });
    });

    if (order.user?.telegramId) {
      await this.notifications.notifyUserAboutStatusChange(
        order.user.telegramId,
        order.orderNumber,
        SharedOrderStatus.DELIVERY_PAYMENT_PENDING,
        null,
        { amountRub: amount, orderId: order.id, payUrl: url, lines },
      );
    }
    await this.notifications.notifyManagers(
      `RAKETA: по заказу ${order.orderNumber} цена доставки ${rub(amount)} — клиенту отправлена ссылка на оплату.`,
      order.id,
    );
  }

  private async checkTopUp(
    order: CycleOrder,
    target: { kind: 'consolidation' | 'order'; id: string },
    rows: RaketaBillingRow[],
  ): Promise<void> {
    const expected = Number(order.raketaTopupAmount);
    const seen = new Set(Array.isArray(order.raketaTopupSeenIds) ? (order.raketaTopupSeenIds as string[]) : []);
    // Billing history may report kopecks like /price does — accept both.
    const candidates = rows.filter(
      (row) =>
        !seen.has(row.id) &&
        (Math.abs(row.amount - expected) < 1 || Math.abs(row.amount - expected * 100) < 100),
    );
    if (candidates.length === 0) return;

    const used = await this.prisma.order.findMany({
      where: { raketaTopupBillingId: { in: candidates.map((row) => row.id) } },
      select: { raketaTopupBillingId: true },
    });
    const usedIds = new Set(used.map((u) => u.raketaTopupBillingId));
    // Oldest unused matching top-up first (the list comes newest first).
    const row = [...candidates].reverse().find((r) => !usedIds.has(r.id));
    if (!row) return;

    const now = new Date();
    const hasDuty = order.actualDutyRub !== null && Number(order.actualDutyRub) > 0;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            raketaTopupBillingId: row.id,
            status: OrderStatus.DELIVERY_PAID,
            deliveryPaidAt: now,
            ...(hasDuty ? { dutyPaidAt: now } : {}),
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: OrderStatus.DELIVERY_PAID,
            comment: `Клиент оплатил доставку${hasDuty ? ' и пошлину' : ''}: пополнение RAKETA ${rub(row.amount)}.`,
          },
        });
      });
    } catch (error) {
      // Unique billing id: another order took this top-up in a parallel run.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }

    if (order.user?.telegramId) {
      await this.notifications.notifyUserAboutStatusChange(
        order.user.telegramId,
        order.orderNumber,
        SharedOrderStatus.DELIVERY_PAID,
        null,
        { orderId: order.id, allPaid: true },
      );
    }
    await this.payRaketa({ ...order, deliveryPaidAt: now }, target, row.amount);
  }

  private async payRaketa(
    order: CycleOrder,
    target: { kind: 'consolidation' | 'order'; id: string },
    paidByClient?: number,
  ): Promise<void> {
    try {
      await this.raketa.pay(target.kind, target.id);
    } catch (error) {
      const message = `RAKETA: не удалось оплатить ${target.kind === 'consolidation' ? 'объединение' : 'заказ'} — ${errorText(error)}`;
      if (order.raketaLastError !== message.slice(0, 1000)) {
        await this.prisma.order.update({ where: { id: order.id }, data: { raketaLastError: message.slice(0, 1000) } });
        await this.notifications.notifyManagers(
          `${message}\nЗаказ ${order.orderNumber}: клиент оплатил, но списать с баланса RAKETA не получилось. Повторю через 10 минут; можно оплатить вручную в кабинете.`,
          order.id,
        );
      }
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { raketaPaidAt: new Date(), raketaLastError: null },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          comment: `RAKETA: ${target.kind === 'consolidation' ? 'объединение' : 'заказ'} оплачено с баланса — посылка отправляется в Россию.`,
        },
      });
    });
    this.logger.log(`RAKETA ${target.kind} ${target.id} paid for ${order.orderNumber}`);
    await this.notifications.notifyManagers(
      paidByClient
        ? `RAKETA: клиент оплатил доставку по заказу ${order.orderNumber} (${rub(paidByClient)}), ${target.kind === 'consolidation' ? 'объединение' : 'заказ'} оплачено в RAKETA.`
        : `RAKETA: доставка по заказу ${order.orderNumber} оплачена с баланса RAKETA.`,
      order.id,
    );
  }
}
