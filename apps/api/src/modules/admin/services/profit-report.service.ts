import type { ProfitReportDto, ProfitReportOrderRow } from '@lean-poizon/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { OrderStatus } from '@prisma/client';
import ExcelJS from 'exceljs';

import { PrismaService } from '../../../prisma/prisma.service';

const round2 = (n: number): number => Math.round(n * 100) / 100;

const toDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

@Injectable()
export class ProfitReportService {
  private readonly logger = new Logger(ProfitReportService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  /**
   * Compute the net-profit report for an inclusive [from, to] day range.
   *
   * Revenue is realized when an order is marked paid, so we bucket by the
   * timestamp of its PAID_AWAITING_PURCHASE status-history entry (works for
   * both crypto-matched and manually-marked orders, and for historical data
   * created before `paidAt` existed). CANCELLED orders are excluded.
   *
   * Net profit per order = grossCommission − subscriberDiscount, where
   * grossCommission is the commission portion of the order's ORIGINAL total
   * (before any benefit). Because a first-order subscriber benefit waives
   * exactly the commission, benefit orders net to ~0 — which is correct.
   */
  async computeReport(from: Date, to: Date): Promise<ProfitReportDto> {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const paidEvents = await this.prisma.orderStatusHistory.findMany({
      where: {
        toStatus: OrderStatus.PAID_AWAITING_PURCHASE,
        createdAt: { gte: start, lte: end },
        order: { status: { not: OrderStatus.CANCELLED } },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            originalTotalUsd: true,
            benefitDiscountUsd: true,
            pricingCommissionPercent: true,
            pricingCnyToUsd: true,
            pricingCnyToRub: true,
            user: { select: { username: true } },
          },
        },
      },
    });

    const investorSharePercent =
      this.config.get<number>('profit.investorSharePercent') ?? 50;

    const seen = new Set<string>();
    const rows: ProfitReportOrderRow[] = [];
    let revenueUsd = 0;
    let grossCommissionUsd = 0;
    let discountUsd = 0;
    let netProfitUsd = 0;
    let netProfitRub = 0;

    for (const ev of paidEvents) {
      // First PAID transition per order wins (guards against any replays).
      if (seen.has(ev.order.id)) continue;
      seen.add(ev.order.id);

      const o = ev.order;
      const original = Number(o.originalTotalUsd);
      const commissionPct = Number(o.pricingCommissionPercent);
      const discount = Number(o.benefitDiscountUsd);
      const cnyToUsd = Number(o.pricingCnyToUsd);
      const cnyToRub = Number(o.pricingCnyToRub);
      const usdToRub = cnyToUsd > 0 ? cnyToRub / cnyToUsd : 0;

      const grossCommission =
        commissionPct > 0 ? original * (commissionPct / (100 + commissionPct)) : 0;
      const net = Math.max(0, grossCommission - discount);
      const netRub = net * usdToRub;

      revenueUsd += original;
      grossCommissionUsd += grossCommission;
      discountUsd += discount;
      netProfitUsd += net;
      netProfitRub += netRub;

      rows.push({
        orderNumber: o.orderNumber,
        paidAt: ev.createdAt.toISOString(),
        customerUsername: o.user?.username ?? null,
        grossCommissionUsd: round2(grossCommission),
        discountUsd: round2(discount),
        netProfitUsd: round2(net),
        netProfitRub: Math.round(netRub),
      });
    }

    const netProfitRubRounded = Math.round(netProfitRub);
    const investorShareRub = Math.round((netProfitRubRounded * investorSharePercent) / 100);
    const ownerShareRub = netProfitRubRounded - investorShareRub;

    return {
      from: toDateStr(start),
      to: toDateStr(end),
      ordersCount: rows.length,
      revenueUsd: round2(revenueUsd),
      grossCommissionUsd: round2(grossCommissionUsd),
      discountUsd: round2(discountUsd),
      netProfitUsd: round2(netProfitUsd),
      netProfitRub: netProfitRubRounded,
      investorSharePercent,
      investorShareRub,
      ownerShareRub,
      rows,
    };
  }

  /** Build an .xlsx workbook (summary + per-order sheets) from a report. */
  async generateExcel(report: ProfitReportDto): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LH Poizon';
    workbook.created = new Date();

    // ── Summary sheet ─────────────────────────────────────────
    const summary = workbook.addWorksheet('Сводка');
    summary.columns = [
      { header: 'Показатель', key: 'k', width: 34 },
      { header: 'Значение', key: 'v', width: 22 },
    ];
    summary.getRow(1).font = { bold: true, size: 11 };
    summary.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0FE' },
    };

    const ownerSharePercent = 100 - report.investorSharePercent;
    const addRow = (k: string, v: string | number, bold = false) => {
      const row = summary.addRow({ k, v });
      if (bold) row.font = { bold: true };
      return row;
    };

    addRow('Период', `${report.from} — ${report.to}`);
    addRow('Заказов учтено', report.ordersCount);
    addRow('Выручка (USD)', report.revenueUsd);
    addRow('Комиссия сервиса (USD)', report.grossCommissionUsd);
    addRow('Скидки подписчикам (USD)', report.discountUsd);
    addRow('Чистая прибыль (USD)', report.netProfitUsd, true);
    addRow('Чистая прибыль (₽)', report.netProfitRub, true);
    summary.addRow({ k: '', v: '' });
    addRow(`Доля инвестора (${report.investorSharePercent}%) (₽)`, report.investorShareRub, true);
    addRow(`Ваша доля (${ownerSharePercent}%) (₽)`, report.ownerShareRub, true);

    // ── Orders sheet ──────────────────────────────────────────
    const sheet = workbook.addWorksheet('Заказы');
    sheet.columns = [
      { header: '№ заказа', key: 'orderNumber', width: 14 },
      { header: 'Дата оплаты', key: 'paidAt', width: 18 },
      { header: 'Клиент', key: 'customer', width: 20 },
      { header: 'Комиссия (USD)', key: 'gross', width: 16 },
      { header: 'Скидка (USD)', key: 'discount', width: 14 },
      { header: 'Прибыль (USD)', key: 'netUsd', width: 16 },
      { header: 'Прибыль (₽)', key: 'netRub', width: 14 },
    ];
    sheet.getRow(1).font = { bold: true, size: 11 };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0FE' },
    };

    for (const row of report.rows) {
      sheet.addRow({
        orderNumber: row.orderNumber,
        paidAt: this.formatDateTime(row.paidAt),
        customer: row.customerUsername ? `@${row.customerUsername}` : '—',
        gross: row.grossCommissionUsd,
        discount: row.discountUsd,
        netUsd: row.netProfitUsd,
        netRub: row.netProfitRub,
      });
    }

    const totals = sheet.addRow({
      orderNumber: 'ИТОГО',
      paidAt: '',
      customer: '',
      gross: report.grossCommissionUsd,
      discount: report.discountUsd,
      netUsd: report.netProfitUsd,
      netRub: report.netProfitRub,
    });
    totals.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Auto-generate the previous month's report on the 1st at 09:00 and send
   * it to the configured Telegram recipients (you + investor). No-op when
   * PROFIT_REPORT_TELEGRAM_IDS is empty.
   */
  @Cron('0 9 1 * *')
  async sendMonthlyReport(): Promise<void> {
    const recipients =
      this.config.get<string[]>('profit.reportTelegramIds') ?? [];
    if (recipients.length === 0) return;

    const now = new Date();
    // Previous month: [1st 00:00, last day 23:59].
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);

    try {
      const report = await this.computeReport(from, to);
      const buffer = await this.generateExcel(report);
      const period = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;
      const caption = [
        `📊 Отчёт о прибыли за ${period}`,
        ``,
        `Чистая прибыль: ${report.netProfitRub} ₽`,
        `Доля инвестора (${report.investorSharePercent}%): ${report.investorShareRub} ₽`,
        `Ваша доля: ${report.ownerShareRub} ₽`,
      ].join('\n');

      for (const chatId of recipients) {
        await this.sendDocument(chatId, buffer, `profit-${period}.xlsx`, caption);
      }
      this.logger.log(`Monthly profit report ${period} sent to ${recipients.length} recipient(s).`);
    } catch (error) {
      this.logger.error(
        `Failed to send monthly profit report: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async sendDocument(
    chatId: string,
    buffer: Buffer,
    filename: string,
    caption: string,
  ): Promise<void> {
    const botToken = this.config.get<string>('telegram.botToken');
    if (!botToken) return;

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append(
      'document',
      new Blob([new Uint8Array(buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      filename,
    );

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendDocument`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.warn(`sendDocument to ${chatId} failed: ${response.status} ${text.slice(0, 200)}`);
    }
  }

  private formatDateTime(iso: string): string {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
  }
}
