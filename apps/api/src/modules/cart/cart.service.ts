import type { CartResponse } from '@lean-poizon/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemQuantityDto } from './dto/update-cart-item-quantity.dto';
import { mapCartToResponse } from './mappers/cart-response.mapper';

@Injectable()
export class CartService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
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

    return this.getCurrentCart(userId);
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
