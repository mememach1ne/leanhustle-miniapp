import type { DewuResolvedProduct } from '@lean-poizon/shared';
import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ChatCalc, Prisma, type User } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { OrdersService } from '../orders/orders.service';
import { PricingService } from '../pricing/pricing.service';
import { type DeliveryAdjuster, RegionalDeliveryService } from '../pricing/services/regional-delivery.service';
import { ProductsService } from '../products/products.service';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
import { CALC_CARD_HTML } from './calc-card.html';

const MAX_LINES = 30;
const PAGE = 5;
const MAX_DATA = 1024;
/** An open calculation keeps taking links for this long after its last change. */
const OPEN_FOR_MS = 2 * 60 * 60 * 1000;
const LINK_RE = /https?:\/\/[^\s<>"']+/gi;
const SUPPORTED_HOST = /(^|\.)(dw4\.co|dewu\.com|poizon\.com|poizonresell\.com)$/i;

/** One product line of a calculation (stored in chat_calcs.lines). */
interface CalcLine {
  /** Original link from the message. */
  link: string;
  st: 'wait' | 'ok' | 'err';
  err?: string;
  spu?: string;
  title?: string;
  img?: string | null;
  c1?: string | null;
  c2?: string | null;
  c3?: string | null;
  /** Available sizes: dwSkuId, size label, price ¥. */
  skus?: Array<{ id: string; s: string; y: number }>;
  /** Chosen dwSkuId (null = not chosen yet). */
  sku: string | null;
  qty: number;
}

interface Pricing {
  settings: Awaited<ReturnType<SettingsService['getCurrentSettings']>>;
  discount: number;
  adjust: DeliveryAdjuster | null;
  city: string;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const usd = (value: number) => `$${value.toFixed(2)}`;
const usdShort = (value: number) => `$${Math.round(value)}`;
const rub = (value: number) => `${new Intl.NumberFormat('ru-RU').format(Math.round(value))} ₽`;

/** Poizon/Dewu links in a message (deduplicated, in order). */
export function extractProductLinks(text: string): string[] {
  const links: string[] = [];
  for (const match of text.match(LINK_RE) ?? []) {
    const link = match.replace(/[),.;!?»]+$/, '');
    try {
      if (SUPPORTED_HOST.test(new URL(link).hostname) && !links.includes(link)) links.push(link);
    } catch {
      // not a URL
    }
  }
  return links;
}

/**
 * Multi-link price calculation in the chat with the bot. The client sends
 * Poizon links (one or several messages); they go into one «Расчёт» card
 * (a Telegram widget) — resolved one by one under the per-user engine quota,
 * then the client picks sizes / quantities by taps and sends everything to
 * the cart or orders right away. The card is re-rendered by the server
 * (editMessageWidgetData) after every change.
 */
@Injectable()
export class ChatCalcService {
  private readonly logger = new Logger(ChatCalcService.name);
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly processing = new Set<string>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ProductsService) private readonly products: ProductsService,
    @Inject(PricingService) private readonly pricing: PricingService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(LoyaltyService) private readonly loyalty: LoyaltyService,
    @Inject(RegionalDeliveryService) private readonly regional: RegionalDeliveryService,
    @Inject(CartService) private readonly cart: CartService,
    @Inject(OrdersService) private readonly orders: OrdersService,
  ) {}

  /** Links from a client's message. Returns false when the message has none. */
  async intake(input: {
    telegramId: string;
    chatId: string;
    text: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
  }): Promise<{ handled: boolean }> {
    const links = extractProductLinks(input.text);
    if (links.length === 0) return { handled: false };
    const user = await this.users.upsertTelegramUser({
      telegramId: input.telegramId,
      username: input.username,
      firstName: input.firstName || input.username || 'Telegram user',
      lastName: input.lastName,
      languageCode: input.languageCode,
    });

    const open = await this.prisma.chatCalc.findFirst({
      where: { chatId: input.chatId, status: 'open', updatedAt: { gte: new Date(Date.now() - OPEN_FOR_MS) } },
      orderBy: { updatedAt: 'desc' },
    });
    const calcId = open?.id ?? (await this.prisma.chatCalc.create({ data: { userId: user.id, chatId: input.chatId } })).id;

    await this.withLock(calcId, async () => {
      const calc = await this.prisma.chatCalc.findUniqueOrThrow({ where: { id: calcId } });
      const lines = this.linesOf(calc);
      const known = new Set(lines.map((l) => l.link));
      const fresh = links.filter((l) => !known.has(l));
      const room = MAX_LINES - lines.length;
      for (const link of fresh.slice(0, Math.max(0, room))) lines.push({ link, st: 'wait', sku: null, qty: 1 });
      const notice =
        fresh.length > room ? `В расчёте максимум ${MAX_LINES} позиций — лишние ссылки не добавлены` : null;
      await this.prisma.chatCalc.update({
        where: { id: calcId },
        data: { lines: lines as unknown as Prisma.InputJsonValue, notice },
      });
      // The card moves down to the new message so it stays in view.
      await this.render(calcId, { resend: true });
    });
    void this.process(calcId);
    return { handled: true };
  }

  /** Card query (a tap). Returns false if the message isn't a calculation card. */
  async handleQuery(query: { id: string; fromId: string; data: string; chatId?: string; messageId?: number }): Promise<boolean> {
    if (!query.chatId || !query.messageId) return false;
    const calc = await this.prisma.chatCalc.findFirst({ where: { chatId: query.chatId, messageId: query.messageId } });
    if (!calc) return false;
    try {
      await this.withLock(calc.id, () => this.apply(calc.id, query.data));
    } catch (error) {
      this.logger.warn(`Calc ${calc.id} query «${query.data}» failed: ${errorText(error)}`);
    }
    await this.call('answerWidgetQuery', { widget_query_id: query.id, data: 'ok' }).catch(() => undefined);
    return true;
  }

  private async apply(calcId: string, data: string): Promise<void> {
    const calc = await this.prisma.chatCalc.findUniqueOrThrow({ where: { id: calcId } });
    const lines = this.linesOf(calc);
    const update: Prisma.ChatCalcUpdateInput = {};
    const line = (i: number) => (Number.isInteger(i) && i >= 0 && i < lines.length ? lines[i] : null);
    let m: RegExpMatchArray | null;

    if (calc.status !== 'open') {
      if (data === 'n') await this.close(calc);
      return;
    }
    if ((m = data.match(/^e(\d+)$/))) {
      const i = Number(m[1]);
      if (!line(i)) return;
      update.expanded = calc.expanded === i ? null : i;
      update.page = Math.floor(i / PAGE);
    } else if ((m = data.match(/^s(\d+)\.(\d+)$/))) {
      const l = line(Number(m[1]));
      const sku = l?.skus?.[Number(m[2])];
      if (!l || !sku) return;
      l.sku = sku.id;
      update.expanded = null;
    } else if ((m = data.match(/^q(\d+)([+-])$/))) {
      const l = line(Number(m[1]));
      if (!l) return;
      l.qty = Math.min(20, Math.max(1, l.qty + (m[2] === '+' ? 1 : -1)));
    } else if ((m = data.match(/^a(\d+)$/))) {
      const i = Number(m[1]);
      const l = line(i);
      if (!l || lines.length >= MAX_LINES) return;
      lines.splice(i + 1, 0, { ...l, sku: null, qty: 1 });
      update.expanded = i + 1;
      update.page = Math.floor((i + 1) / PAGE);
    } else if ((m = data.match(/^x(\d+)$/))) {
      const i = Number(m[1]);
      if (!line(i)) return;
      lines.splice(i, 1);
      update.expanded = null;
      update.page = Math.min(calc.page, Math.max(0, Math.ceil(lines.length / PAGE) - 1));
    } else if ((m = data.match(/^p(\d+)$/))) {
      const page = Number(m[1]);
      if (page < 0 || page >= Math.ceil(lines.length / PAGE)) return;
      update.page = page;
      update.expanded = null;
    } else if (data === 'c') {
      await this.toCart(calc, lines);
      return;
    } else if (data === 'o') {
      // «Оформить» → choose where to deliver first.
      if (lines.some((l) => l.st === 'wait' || (l.st === 'ok' && !l.sku)) || !lines.some((l) => l.st === 'ok')) return;
      const addresses = await this.addressesOf(calc.userId);
      if (addresses.length === 0) {
        await this.prisma.chatCalc.update({
          where: { id: calcId },
          data: { notice: 'Сначала добавьте адрес доставки в приложении — или отправьте всё в корзину' },
        });
        await this.render(calcId);
        return;
      }
      const keep = addresses.some((a) => a.id === calc.addressId) ? calc.addressId : addresses[0].id;
      update.mode = 'address';
      update.addressId = keep;
      update.expanded = null;
    } else if ((m = data.match(/^A(\d+)$/))) {
      const address = (await this.addressesOf(calc.userId))[Number(m[1])];
      if (!address || calc.mode !== 'address') return;
      update.addressId = address.id;
    } else if (data === 'b') {
      update.mode = null;
    } else if (data === 'O') {
      if (calc.mode !== 'address') return;
      await this.orderNow(calc, lines);
      return;
    } else if (data === 'n') {
      await this.close(calc);
      return;
    } else {
      return;
    }
    await this.prisma.chatCalc.update({
      where: { id: calcId },
      data: { ...update, lines: lines as unknown as Prisma.InputJsonValue, notice: null },
    });
    await this.render(calcId);
  }

  /** Resolves waiting lines one by one, waiting out the per-minute engine quota. */
  private async process(calcId: string): Promise<void> {
    if (this.processing.has(calcId)) return;
    this.processing.add(calcId);
    try {
      for (;;) {
        const calc = await this.prisma.chatCalc.findUnique({ where: { id: calcId } });
        if (!calc || calc.status !== 'open') return;
        const index = this.linesOf(calc).findIndex((l) => l.st === 'wait');
        if (index < 0) return;
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: calc.userId } });
        const result = await this.resolve(user, this.linesOf(calc)[index].link);
        await this.withLock(calcId, async () => {
          const fresh = await this.prisma.chatCalc.findUniqueOrThrow({ where: { id: calcId } });
          const lines = this.linesOf(fresh);
          // Lines may have moved (removed / duplicated) meanwhile — find it again by link.
          const target = lines.find((l) => l.st === 'wait' && l.link === this.linesOf(calc)[index].link);
          if (!target) return;
          Object.assign(target, result);
          await this.prisma.chatCalc.update({
            where: { id: calcId },
            data: { lines: lines as unknown as Prisma.InputJsonValue },
          });
          await this.render(calcId);
        });
      }
    } catch (error) {
      this.logger.warn(`Calc ${calcId} processing stopped: ${errorText(error)}`);
    } finally {
      this.processing.delete(calcId);
    }
  }

  private async resolve(user: User, link: string): Promise<Partial<CalcLine>> {
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        const product = await this.products.resolveProduct({ link }, user);
        return this.fromProduct(product);
      } catch (error) {
        const message = errorText(error);
        if (error instanceof HttpException && error.getStatus() === 429) {
          if (/дневной лимит/i.test(message)) return { st: 'err', err: 'дневной лимит, попробуйте завтра' };
          await sleep(13_000);
          continue;
        }
        // The price engine is down / can't reach Poizon — wait and try again for a few minutes.
        if (error instanceof HttpException && error.getStatus() === 503) {
          if (attempt < 5) {
            await sleep(60_000);
            continue;
          }
          return { st: 'err', err: 'сервис цен временно недоступен' };
        }
        return { st: 'err', err: /не распознана/i.test(message) ? 'ссылка не распознана' : 'не удалось посчитать' };
      }
    }
    return { st: 'err', err: 'не удалось посчитать' };
  }

  private fromProduct(product: DewuResolvedProduct): Partial<CalcLine> {
    const skus = product.skus
      .filter((s) => s.isAvailable && s.priceYuan !== null)
      .map((s) => ({ id: s.dwSkuId, s: [s.size, s.version].filter(Boolean).join(' ').slice(0, 14), y: s.priceYuan as number }));
    if (skus.length === 0) return { st: 'err', err: 'нет в наличии', title: product.title };
    return {
      st: 'ok',
      spu: product.dwSpuId,
      title: product.title,
      img: product.mainImage ?? null,
      c1: product.categoryL1 ?? null,
      c2: product.categoryL2 ?? null,
      c3: product.categoryL3 ?? null,
      skus,
      // One size only (a cap, a bag) — nothing to choose.
      sku: skus.length === 1 ? skus[0].id : null,
    };
  }

  /** Unit price of a line's size: total $ (with commission/loyalty), delivery ₽, duty ₽. */
  private price(line: CalcLine, yuan: number, p: Pricing, size?: string) {
    const category = this.pricing.classifyDeliveryCategory({
      title: line.title ?? '',
      categoryL1: line.c1,
      categoryL2: line.c2,
      categoryL3: line.c3,
    });
    const r = this.pricing.recalculateFromYuan(
      new Prisma.Decimal(yuan),
      category,
      p.settings,
      p.discount,
      { title: line.title, categoryL1: line.c1, categoryL2: line.c2, categoryL3: line.c3, size },
      p.adjust,
    );
    return { usd: Number(r.totalUsd), delivery: r.deliveryRub, duty: r.dutyRub, category };
  }

  /** The client's addresses for the card (default first; at most 6 fit). */
  private addressesOf(userId: string) {
    return this.prisma.deliveryAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      take: 6,
    });
  }

  private async pricingFor(userId: string, addressId?: string | null): Promise<Pricing> {
    const settings = await this.settings.getCurrentSettings();
    const discount = await this.loyalty.getDiscountPercentPoints({ id: userId }, settings);
    const address =
      (addressId ? await this.prisma.deliveryAddress.findFirst({ where: { id: addressId, userId } }) : null) ??
      (await this.prisma.deliveryAddress.findFirst({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }));
    const { hub, options } = await this.regional.optionsFor({
      cityId: address?.cityId,
      city: address?.city,
      region: address?.region,
      carrier: address?.carrier,
      kind: address?.kind,
      courierIndex: address?.kind === 'courier' ? address.pvzIndex : null,
    });
    const option = options.find((o) => o.tariff !== 'EXPR') ?? options[0];
    return { settings, discount, adjust: option?.adjust ?? null, city: address?.city ?? hub.name };
  }

  /** chat_data of the card (≤ 1024 bytes). */
  private async state(calc: ChatCalc): Promise<Record<string, unknown>> {
    const lines = this.linesOf(calc);
    const status = calc.status === 'cart' ? 'c' : calc.status === 'ordered' ? 'd' : calc.status === 'closed' ? 'x' : 'o';
    const base: Record<string, unknown> = { s: status, n: lines.length };
    if (status === 'd' && calc.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: calc.orderId }, select: { orderNumber: true } });
      base.on = order?.orderNumber ?? '';
      base.oi = calc.orderId;
    }
    if (status === 'x') base.m = 'Пришлите новые ссылки — начну новый расчёт';
    if (status !== 'o') return base;

    const p = await this.pricingFor(calc.userId, calc.addressId);
    const pages = Math.max(1, Math.ceil(lines.length / PAGE));
    const page = Math.min(calc.page, pages - 1);
    let goods = 0;
    let delivery = 0;
    let duty = 0;
    let missing = 0;
    let waiting = 0;
    let failed = 0;
    const view = lines.map((l, i) => {
      if (l.st === 'wait') {
        waiting++;
        return [i, l.title ?? 'Ссылка Poizon', '', l.qty, '', 1] as const;
      }
      if (l.st === 'err') {
        failed++;
        return [i, l.title ?? 'Ссылка Poizon', '', l.qty, l.err ?? 'ошибка', 2] as const;
      }
      const sku = l.skus?.find((s) => s.id === l.sku);
      if (!sku) {
        missing++;
        const min = Math.min(...(l.skus ?? []).map((s) => s.y));
        const cheapest = (l.skus ?? []).find((s) => s.y === min);
        return [i, l.title ?? '', '', l.qty, `от ${usdShort(this.price(l, min, p, cheapest?.s).usd)}`, 0] as const;
      }
      const unit = this.price(l, sku.y, p, sku.s);
      goods += unit.usd * l.qty;
      delivery += unit.delivery * l.qty;
      duty += unit.duty * l.qty;
      return [i, l.title ?? '', sku.s, l.qty, usd(unit.usd * l.qty), 0] as const;
    });

    const state: Record<string, unknown> = {
      ...base,
      pg: page,
      pc: pages,
      ok: waiting === 0 && missing === 0 && view.some((v) => v[5] === 0) ? 1 : 0,
    };
    state.m =
      calc.notice ??
      (waiting
        ? `Считаю: осталось ${waiting}…`
        : missing
          ? `Выберите размер: ${missing} ${missing === 1 ? 'позиция' : missing < 5 ? 'позиции' : 'позиций'}`
          : failed
            ? `Не удалось посчитать: ${failed}`
            : 'Всё готово — можно оформлять');
    if (goods > 0) state.T = { g: usd(goods), d: rub(delivery), c: p.city, ...(duty > 0 ? { u: rub(duty) } : {}) };

    if (calc.mode === 'address') {
      const addresses = await this.addressesOf(calc.userId);
      state.A = addresses.map((a) => [a.fullName.slice(0, 40), a.cdekAddress.replace(/\s*\([A-Za-z0-9_-]+\)\s*$/, '').slice(0, 60)]);
      state.k = addresses.findIndex((a) => a.id === calc.addressId);
      state.m = 'Куда доставить?';
      delete state.L;
      return state;
    }
    const expanded = calc.expanded !== null ? lines[calc.expanded] : undefined;
    if (expanded?.st === 'ok' && expanded.skus) {
      state.X = {
        i: calc.expanded,
        k: expanded.skus.findIndex((s) => s.id === expanded.sku),
        s: expanded.skus.map((s) => [s.s, usdShort(this.price(expanded, s.y, p, s.s).usd)]),
        p: expanded.spu,
      };
    }
    // Page lines; titles shrink until everything fits into chat_data.
    for (const max of [34, 26, 18, 12]) {
      state.L = view
        .slice(page * PAGE, page * PAGE + PAGE)
        .map((v) => [v[0], String(v[1]).slice(0, max), v[2], v[3], v[4], v[5]]);
      if (Buffer.byteLength(JSON.stringify(state)) <= MAX_DATA) return state;
    }
    if (state.X) (state.X as { s: Array<[string, string]> }).s = (state.X as { s: Array<[string, string]> }).s.slice(0, 24);
    return state;
  }

  /** Sends the card (or a new one at the bottom) / updates it. */
  private async render(calcId: string, options: { resend?: boolean } = {}): Promise<void> {
    const calc = await this.prisma.chatCalc.findUniqueOrThrow({ where: { id: calcId } });
    const data = JSON.stringify(await this.state(calc));
    if (calc.messageId && !options.resend) {
      if (calc.widgetState === data) return;
      try {
        await this.call('editMessageWidgetData', { chat_id: calc.chatId, message_id: calc.messageId, chat_data: data });
        await this.prisma.chatCalc.update({ where: { id: calcId }, data: { widgetState: data } });
        return;
      } catch (error) {
        if (/message is not modified/i.test(errorText(error))) return;
        if (!/not found|MESSAGE_ID_INVALID|can't be edited/i.test(errorText(error))) throw error;
      }
    }
    if (calc.messageId) {
      await this.call('deleteMessage', { chat_id: calc.chatId, message_id: calc.messageId }).catch(() => undefined);
    }
    const message = (await this.call('sendWidget', {
      chat_id: calc.chatId,
      html: CALC_CARD_HTML,
      chat_data: data,
      allow_queries: true,
    })) as { message_id: number };
    await this.prisma.chatCalc.update({ where: { id: calcId }, data: { messageId: message.message_id, widgetState: data } });
  }

  /** «В корзину»: every line with a size goes to the mini app cart. */
  private async toCart(calc: ChatCalc, lines: CalcLine[]): Promise<void> {
    const ready = lines.filter((l) => l.st === 'ok' && l.sku);
    if (ready.length === 0 || lines.some((l) => l.st === 'wait' || (l.st === 'ok' && !l.sku))) return;
    const discount = await this.loyalty.getDiscountPercentPoints({ id: calc.userId });
    for (const l of ready) {
      const product = this.asProduct(l);
      const r = await this.pricing.calculate({ product, dwSkuId: l.sku as string } as never, discount);
      await this.cart.addItem(calc.userId, {
        dewuLink: l.link,
        dwSpuId: l.spu as string,
        dwSkuId: r.dwSkuId,
        productTitle: l.title ?? '',
        productImage: l.img ?? undefined,
        size: r.size,
        version: r.version,
        categoryL1: l.c1 ?? undefined,
        categoryL2: l.c2 ?? undefined,
        categoryL3: l.c3 ?? undefined,
        priceYuan: r.priceYuan,
        totalUsd: r.totalUsd,
        deliveryRub: r.deliveryRub,
        dutyRub: r.dutyRub,
        categoryGroup: r.categoryGroup,
        deliveryCategory: r.deliveryCategory,
        estimatedWeightKg: r.estimatedWeightKg,
        quantity: l.qty,
      });
    }
    await this.prisma.chatCalc.update({ where: { id: calc.id }, data: { status: 'cart', expanded: null } });
    await this.render(calc.id);
  }

  /** «Оформить»: an order from the lines to the default address, standard delivery. */
  private async orderNow(calc: ChatCalc, lines: CalcLine[]): Promise<void> {
    if (lines.some((l) => l.st === 'wait' || (l.st === 'ok' && !l.sku))) return;
    const ready = lines.filter((l) => l.st === 'ok' && l.sku);
    if (ready.length === 0) return;
    const address = calc.addressId
      ? await this.prisma.deliveryAddress.findFirst({ where: { id: calc.addressId, userId: calc.userId } })
      : null;
    if (!address || !address.cityId) {
      await this.prisma.chatCalc.update({
        where: { id: calc.id },
        data: {
          mode: null,
          notice: address
            ? 'У этого адреса нет пункта выдачи из списка — выберите его в приложении'
            : 'Сначала добавьте адрес доставки в приложении — или отправьте всё в корзину',
        },
      });
      await this.render(calc.id);
      return;
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: calc.userId } });
    try {
      const discount = await this.loyalty.getDiscountPercentPoints({ id: calc.userId });
      const items = [];
      for (const [i, l] of ready.entries()) {
        const r = await this.pricing.calculate({ product: this.asProduct(l), dwSkuId: l.sku as string } as never, discount);
        items.push({
          id: `chat-${i}`,
          dewuLink: l.link,
          dwSpuId: l.spu as string,
          dwSkuId: r.dwSkuId,
          productTitle: l.title ?? '',
          productImage: l.img ?? null,
          categoryL1: l.c1 ?? null,
          categoryL2: l.c2 ?? null,
          categoryL3: l.c3 ?? null,
          sizeLabel: r.size,
          versionLabel: r.version ?? null,
          quantity: l.qty,
          priceYuan: new Prisma.Decimal(r.priceYuan),
          categoryGroup: r.categoryGroup,
          deliveryCategory: r.deliveryCategory,
          estimatedWeightKg: new Prisma.Decimal(r.estimatedWeightKg),
        });
      }
      const { order } = await this.orders.checkout(user, { deliveryAddressId: address.id }, items);
      await this.prisma.chatCalc.update({
        where: { id: calc.id },
        data: { status: 'ordered', orderId: order.id, expanded: null, mode: null },
      });
    } catch (error) {
      await this.prisma.chatCalc.update({
        where: { id: calc.id },
        data: { notice: errorText(error).slice(0, 190) },
      });
    }
    await this.render(calc.id);
  }

  private async close(calc: ChatCalc): Promise<void> {
    await this.prisma.chatCalc.update({ where: { id: calc.id }, data: { status: 'closed', expanded: null } });
    await this.render(calc.id);
  }

  private asProduct(l: CalcLine): DewuResolvedProduct {
    return {
      originalLink: l.link,
      resolvedUrl: l.link,
      dwSpuId: l.spu as string,
      title: l.title ?? '',
      mainImage: l.img ?? undefined,
      gallery: [],
      categoryL1: l.c1 ?? undefined,
      categoryL2: l.c2 ?? undefined,
      categoryL3: l.c3 ?? undefined,
      skus: (l.skus ?? []).map((s) => ({ dwSkuId: s.id, size: s.s, minBidPrice: s.y, isAvailable: true, priceYuan: s.y })),
      availableSkus: [],
    };
  }

  private linesOf(calc: ChatCalc): CalcLine[] {
    return Array.isArray(calc.lines) ? (calc.lines as unknown as CalcLine[]) : [];
  }

  private withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(fn);
    const tail = run.catch(() => undefined);
    this.locks.set(id, tail);
    void tail.then(() => {
      if (this.locks.get(id) === tail) this.locks.delete(id);
    });
    return run;
  }

  private async call(method: string, payload: Record<string, unknown>): Promise<unknown> {
    const token = this.config.get<string>('telegram.botToken');
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; description?: string } | null;
    if (!res.ok || !body?.ok) throw new Error(`${method}: ${body?.description ?? `HTTP ${res.status}`}`);
    return body.result;
  }
}

