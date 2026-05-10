import type { AdminUserListItemDto } from '@lean-poizon/shared';
import { ORDER_STATUS_LABELS } from '@lean-poizon/shared';
import { Injectable } from '@nestjs/common';
import type { Order, OrderItem, User } from '@prisma/client';
import ExcelJS from 'exceljs';

@Injectable()
export class ExcelExportService {
  async generateUsersExcel(users: AdminUserListItemDto[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LH Poizon';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Клиенты');

    sheet.columns = [
      { header: '№', key: 'num', width: 6 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Дата регистрации', key: 'createdAt', width: 18 },
      { header: 'Заказов', key: 'ordersCount', width: 10 },
      { header: 'Средний чек (₽)', key: 'averageCheckRub', width: 16 },
      { header: 'Прибыль (₽)', key: 'totalProfitRub', width: 14 },
      { header: 'Подписчик канала', key: 'isChannelSubscriber', width: 18 },
      { header: 'Последний заказ', key: 'lastOrderDate', width: 18 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0FE' },
    };

    users.forEach((user, index) => {
      sheet.addRow({
        num: index + 1,
        username: user.username ? `@${user.username}` : '—',
        createdAt: this.formatDate(user.createdAt),
        ordersCount: user.ordersCount,
        averageCheckRub: user.averageCheckRub,
        totalProfitRub: user.totalProfitRub,
        isChannelSubscriber: user.isChannelSubscriber ? 'Да' : 'Нет',
        lastOrderDate: user.lastOrderDate ? this.formatDate(user.lastOrderDate) : '—',
      });
    });

    // Summary row
    const totalOrders = users.reduce((sum, u) => sum + u.ordersCount, 0);
    const totalProfit = users.reduce((sum, u) => sum + u.totalProfitRub, 0);
    const summaryRow = sheet.addRow({
      num: '',
      username: 'ИТОГО',
      createdAt: '',
      ordersCount: totalOrders,
      averageCheckRub: '',
      totalProfitRub: totalProfit,
      isChannelSubscriber: '',
      lastOrderDate: '',
    });
    summaryRow.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generateUserOrdersExcel(
    user: User,
    orders: (Order & { items: OrderItem[] })[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LH Poizon';
    workbook.created = new Date();

    const username = user.username ? `@${user.username}` : user.telegramId;
    const sheet = workbook.addWorksheet(`Заказы ${username}`);

    sheet.columns = [
      { header: '№ заказа', key: 'orderNumber', width: 14 },
      { header: 'Статус', key: 'status', width: 22 },
      { header: 'Дата', key: 'createdAt', width: 14 },
      { header: 'Товаров', key: 'itemsCount', width: 10 },
      { header: 'Сумма (USD)', key: 'totalUsd', width: 14 },
      { header: 'Доставка (₽)', key: 'deliveryRub', width: 14 },
      { header: 'Пошлина (₽)', key: 'dutyRub', width: 14 },
      { header: 'Комиссия (%)', key: 'commissionPercent', width: 14 },
      { header: 'Трек-код', key: 'trackCode', width: 20 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0FE' },
    };

    for (const order of orders) {
      const statusLabel =
        ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ??
        order.status;

      sheet.addRow({
        orderNumber: order.orderNumber,
        status: statusLabel,
        createdAt: this.formatDate(order.createdAt.toISOString()),
        itemsCount: order.itemsCount,
        totalUsd: Number(order.totalUsd),
        deliveryRub: Number(order.deliveryRub),
        dutyRub: Number(order.dutyRub),
        commissionPercent: Number(order.pricingCommissionPercent),
        trackCode: order.trackCode ?? '—',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }
}
