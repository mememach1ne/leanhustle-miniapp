import type {
  AdminOrdersResponse,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminUsersResponse,
  StaffOrderDetailsDto,
  StaffOrderListItemDto,
} from '@lean-poizon/shared';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  mapOrderToStaffDetailsDto,
  mapOrderToStaffListItemDto,
} from '../orders/mappers/order-response.mapper';

// "Active" = anything not yet delivered (and not cancelled). Phase 2 of the
// flow (actual delivery / duty / track code) keeps orders active until the
// manager explicitly marks them DELIVERED.
const ACTIVE_STATUSES = [
  OrderStatus.CREATED,
  OrderStatus.PAYMENT_PENDING,
  OrderStatus.PAID_AWAITING_PURCHASE,
  OrderStatus.PURCHASED,
  OrderStatus.DELIVERY_PAYMENT_PENDING,
  OrderStatus.DELIVERY_PAID,
  OrderStatus.DUTY_PAYMENT_PENDING,
  OrderStatus.DUTY_PAID,
  OrderStatus.TRACK_CODE_RECEIVED,
];

// "Completed" = terminal states only. CANCELLED is shown elsewhere.
const COMPLETED_STATUSES = [OrderStatus.DELIVERED];

const ORDER_INCLUDE_LIST = {
  user: {
    select: {
      id: true,
      telegramId: true,
      username: true,
      firstName: true,
      lastName: true,
    },
  },
  items: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      productTitle: true,
      productImage: true,
    },
  },
};

const ORDER_INCLUDE_DETAILS = {
  user: {
    select: {
      id: true,
      telegramId: true,
      username: true,
      firstName: true,
      lastName: true,
    },
  },
  items: {
    orderBy: { createdAt: 'asc' as const },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  // ─── Orders ────────────────────────────────────────────────

  async getOrders(
    status: 'active' | 'completed',
    page: number,
    pageSize: number,
  ): Promise<AdminOrdersResponse> {
    const statuses = status === 'active' ? ACTIVE_STATUSES : COMPLETED_STATUSES;
    const pg = Number(page) || 1;
    const ps = Number(pageSize) || 20;
    const skip = (pg - 1) * ps;

    try {
      const [data, total] = await Promise.all([
        this.prisma.order.findMany({
          where: { status: { in: statuses } },
          include: ORDER_INCLUDE_LIST,
          orderBy: { createdAt: 'desc' },
          skip,
          take: ps,
        }),
        this.prisma.order.count({
          where: { status: { in: statuses } },
        }),
      ]);

      return {
        data: data.map(mapOrderToStaffListItemDto),
        total,
        page: pg,
        pageSize: ps,
      };
    } catch (error) {
      this.logger.error(
        `getOrders failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async searchOrders(query: string): Promise<StaffOrderListItemDto[]> {
    const trimmed = query.trim().slice(0, 100);
    if (!trimmed) return [];

    // Try order number search first
    const byNumber = await this.prisma.order.findMany({
      where: {
        orderNumber: { contains: trimmed, mode: 'insensitive' },
      },
      include: ORDER_INCLUDE_LIST,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (byNumber.length > 0) {
      return byNumber.map(mapOrderToStaffListItemDto);
    }

    // Try user search (username or telegramId)
    const byUser = await this.prisma.order.findMany({
      where: {
        user: {
          OR: [
            { username: { contains: trimmed, mode: 'insensitive' } },
            { telegramId: { contains: trimmed } },
            { firstName: { contains: trimmed, mode: 'insensitive' } },
          ],
        },
      },
      include: ORDER_INCLUDE_LIST,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return byUser.map(mapOrderToStaffListItemDto);
  }

  async getOrderById(id: string): Promise<StaffOrderDetailsDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE_DETAILS,
    });

    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }

    return mapOrderToStaffDetailsDto(order);
  }

  // ─── Users ─────────────────────────────────────────────────

  async getUsers(
    page: number,
    pageSize: number,
    filter = 'all',
    search?: string,
    sortBy = 'createdAt',
  ): Promise<AdminUsersResponse> {
    const pg = Number(page) || 1;
    const ps = Number(pageSize) || 20;

    try {
      // Build where clause
      const where: Record<string, unknown> = {};

      if (filter === 'subscribers') {
        where.isChannelSubscriber = true;
      } else if (filter === 'with_orders') {
        where.orders = { some: {} };
      } else if (filter === 'without_orders') {
        where.orders = { none: {} };
      }

      if (search) {
        where.username = { contains: search, mode: 'insensitive' };
      }

      const userInclude = {
        _count: { select: { orders: true } },
        orders: {
          select: {
            totalUsd: true,
            pricingCommissionPercent: true,
            pricingCnyToRub: true,
            pricingCnyToUsd: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
        },
      };

      // For computed sorts we need to fetch all, sort in memory, then paginate
      if (sortBy !== 'createdAt') {
        const allUsers = await this.prisma.user.findMany({
          where,
          include: userInclude,
          orderBy: { createdAt: 'desc' },
        });

        const mapped = allUsers.map((user) => this.mapUserToListItem(user));

        // Sort by computed field
        mapped.sort((a, b) => {
          const key = sortBy as keyof AdminUserListItemDto;
          const va = (a[key] as number) ?? 0;
          const vb = (b[key] as number) ?? 0;
          return vb - va; // descending
        });

        const total = mapped.length;
        const skip = (pg - 1) * ps;
        const data = mapped.slice(skip, skip + ps);

        return { data, total, page: pg, pageSize: ps };
      }

      // Default: sort by createdAt — efficient paginated query
      const skip = (pg - 1) * ps;
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: ps,
          include: userInclude,
        }),
        this.prisma.user.count({ where }),
      ]);

      const data = users.map((user) => this.mapUserToListItem(user));

      return { data, total, page: pg, pageSize: ps };
    } catch (error) {
      this.logger.error(
        `getUsers failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getUserById(id: string): Promise<AdminUserDetailDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
        orders: {
          include: ORDER_INCLUDE_LIST,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const statsOrders = user.orders.map((o) => ({
      totalUsd: o.totalUsd,
      pricingCommissionPercent: o.pricingCommissionPercent,
      pricingCnyToRub: o.pricingCnyToRub,
      pricingCnyToUsd: o.pricingCnyToUsd,
      createdAt: o.createdAt,
    }));
    const { averageCheckRub, totalProfitRub } = this.calculateUserStats(statsOrders);

    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      telegramId: user.telegramId,
      isChannelSubscriber: user.isChannelSubscriber,
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: user.lastActiveAt.toISOString(),
      ordersCount: user._count.orders,
      averageCheckRub,
      totalProfitRub,
      orders: user.orders.map(mapOrderToStaffListItemDto),
    };
  }

  async getAllUsersForExport(): Promise<AdminUserListItemDto[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { orders: true } },
        orders: {
          select: {
            totalUsd: true,
            pricingCommissionPercent: true,
            pricingCnyToRub: true,
            pricingCnyToUsd: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return users.map((user) => {
      const { averageCheckRub, totalProfitRub, lastOrderDate } =
        this.calculateUserStats(user.orders);

      return {
        id: user.id,
        username: user.username,
        isChannelSubscriber: user.isChannelSubscriber,
        createdAt: user.createdAt.toISOString(),
        lastActiveAt: user.lastActiveAt.toISOString(),
        ordersCount: user._count.orders,
        averageCheckRub,
        totalProfitRub,
        lastOrderDate,
      };
    });
  }

  async getUserOrdersForExport(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return { user, orders };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private mapUserToListItem(user: {
    id: string;
    username: string | null;
    isChannelSubscriber: boolean;
    createdAt: Date;
    lastActiveAt: Date;
    _count: { orders: number };
    orders: {
      totalUsd: import('@prisma/client').Prisma.Decimal;
      pricingCommissionPercent: import('@prisma/client').Prisma.Decimal;
      pricingCnyToRub: import('@prisma/client').Prisma.Decimal;
      pricingCnyToUsd: import('@prisma/client').Prisma.Decimal;
      createdAt: Date;
    }[];
  }): AdminUserListItemDto {
    const { averageCheckRub, totalProfitRub, lastOrderDate } =
      this.calculateUserStats(user.orders);

    return {
      id: user.id,
      username: user.username,
      isChannelSubscriber: user.isChannelSubscriber,
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: user.lastActiveAt.toISOString(),
      ordersCount: user._count.orders,
      averageCheckRub,
      totalProfitRub,
      lastOrderDate,
    };
  }

  private calculateUserStats(
    orders: {
      totalUsd: import('@prisma/client').Prisma.Decimal;
      pricingCommissionPercent: import('@prisma/client').Prisma.Decimal;
      pricingCnyToRub: import('@prisma/client').Prisma.Decimal;
      pricingCnyToUsd: import('@prisma/client').Prisma.Decimal;
      createdAt: Date;
    }[],
  ) {
    if (orders.length === 0) {
      return { averageCheckRub: 0, totalProfitRub: 0, lastOrderDate: null };
    }

    let totalCheckRub = 0;
    let totalProfitRub = 0;

    for (const order of orders) {
      const totalUsd = Number(order.totalUsd);
      const commissionPercent = Number(order.pricingCommissionPercent);
      const cnyToRub = Number(order.pricingCnyToRub);
      const cnyToUsd = Number(order.pricingCnyToUsd);

      // Convert totalUsd to RUB: totalUsd / cnyToUsd * cnyToRub
      const rateUsdToRub = cnyToUsd > 0 ? cnyToRub / cnyToUsd : 0;
      const totalRub = totalUsd * rateUsdToRub;
      totalCheckRub += totalRub;

      // Profit = commission portion: totalUsd * (commission / (100 + commission)) * usdToRub
      const profitUsd =
        commissionPercent > 0
          ? totalUsd * (commissionPercent / (100 + commissionPercent))
          : 0;
      totalProfitRub += profitUsd * rateUsdToRub;
    }

    const averageCheckRub = Math.round(totalCheckRub / orders.length);
    totalProfitRub = Math.round(totalProfitRub);
    const lastOrderDate = orders[0].createdAt.toISOString();

    return { averageCheckRub, totalProfitRub, lastOrderDate };
  }
}
