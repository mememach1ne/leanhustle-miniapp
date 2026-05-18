import type { CartResponse } from '@lean-poizon/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { DeliveryCategoryWeightService } from '../pricing/services/delivery-category-weight.service';
import { NewCategoryNotificationService } from '../pricing/services/new-category-notification.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemQuantityDto } from './dto/update-cart-item-quantity.dto';
import { mapCartToResponse } from './mappers/cart-response.mapper';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  private readonly prisma: PrismaService;
  private readonly categoryWeightService: DeliveryCategoryWeightService;
  private readonly newCategoryNotificationService: NewCategoryNotificationService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(DeliveryCategoryWeightService)
    categoryWeightService: DeliveryCategoryWeightService,
    @Inject(NewCategoryNotificationService)
    newCategoryNotificationService: NewCategoryNotificationService,
  ) {
    this.prisma = prisma;
    this.categoryWeightService = categoryWeightService;
    this.newCategoryNotificationService = newCategoryNotificationService;
  }

  async getCurrentCart(userId: string): Promise<CartResponse> {
    const cart = await this.findOrCreateCart(userId);
    return mapCartToResponse(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartResponse> {
    const cart = await this.findOrCreateCart(userId);
    const quantity = dto.quantity ?? 1;

    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_dwSkuId: {
          cartId: cart.id,
          dwSkuId: dto.dwSkuId,
        },
      },
    });

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: {
            increment: quantity,
          },
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          dewuLink: dto.dewuLink,
          dwSpuId: dto.dwSpuId,
          dwSkuId: dto.dwSkuId,
          productTitle: dto.productTitle,
          productImage: dto.productImage,
          categoryL1: dto.categoryL1,
          categoryL2: dto.categoryL2,
          categoryL3: dto.categoryL3,
          sizeLabel: dto.size,
          versionLabel: dto.version,
          priceYuan: new Prisma.Decimal(dto.priceYuan),
          totalUsd: new Prisma.Decimal(dto.totalUsd),
          deliveryRub: new Prisma.Decimal(dto.deliveryRub),
          dutyRub: new Prisma.Decimal(dto.dutyRub),
          categoryGroup: dto.categoryGroup,
          deliveryCategory: dto.deliveryCategory,
          estimatedWeightKg: new Prisma.Decimal(dto.estimatedWeightKg),
          quantity,
        },
      });
    }

    // Fire-and-forget: if the product's category has no confirmed weight,
    // bump the encounter counter and notify the manager. We intentionally
    // do NOT await on the network call — cart add must stay fast even if
    // Telegram is slow / unavailable.
    void this.handleCategoryEncounter(userId, dto).catch((err) => {
      this.logger.warn(
        `Failed to handle category encounter: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    return this.getCurrentCart(userId);
  }

  private async handleCategoryEncounter(userId: string, dto: AddCartItemDto): Promise<void> {
    if (!dto.categoryL1 && !dto.categoryL2 && !dto.categoryL3) return;

    const existing = await this.categoryWeightService.lookup(
      dto.categoryL1,
      dto.categoryL2,
      dto.categoryL3,
    );

    // Manager already set a weight — nothing to do.
    if (existing && typeof existing.weightKg === 'number') return;

    const record = await this.categoryWeightService.recordEncounter(
      dto.categoryL1,
      dto.categoryL2,
      dto.categoryL3,
    );

    // Skip notification if weight has been set since the lookup (race condition).
    if (record.weightKg !== null) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, username: true, firstName: true },
    });
    if (!user) return;

    await this.newCategoryNotificationService.notify({
      categoryL1: dto.categoryL1,
      categoryL2: dto.categoryL2,
      categoryL3: dto.categoryL3,
      productTitle: dto.productTitle ?? 'Без названия',
      dewuLink: dto.dewuLink,
      username: user.username,
      firstName: user.firstName,
      telegramId: user.telegramId,
      isFirstEncounter: record.wasCreated,
      encounterCount: record.encounterCount,
    });
  }

  async updateItemQuantity(
    userId: string,
    itemId: string,
    dto: UpdateCartItemQuantityDto,
  ): Promise<CartResponse> {
    const item = await this.getOwnedCartItem(userId, itemId);

    if (dto.quantity < 0) {
      throw new BadRequestException('Количество не может быть отрицательным.');
    }

    if (dto.quantity === 0) {
      await this.prisma.cartItem.delete({
        where: { id: item.id },
      });

      return this.getCurrentCart(userId);
    }

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: {
        quantity: dto.quantity,
      },
    });

    return this.getCurrentCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<CartResponse> {
    const item = await this.getOwnedCartItem(userId, itemId);

    await this.prisma.cartItem.delete({
      where: { id: item.id },
    });

    return this.getCurrentCart(userId);
  }

  private async findOrCreateCart(userId: string) {
    return this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: {
        items: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  private async getOwnedCartItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: {
          userId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Позиция корзины не найдена.');
    }

    return item;
  }
}
