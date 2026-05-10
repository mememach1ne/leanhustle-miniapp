import type { CartResponse } from '@lean-poizon/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemQuantityDto } from './dto/update-cart-item-quantity.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  private readonly cartService: CartService;

  constructor(@Inject(CartService) cartService: CartService) {
    this.cartService = cartService;
  }

  @Get()
  async getCurrentCart(@CurrentUser() user: User): Promise<CartResponse> {
    return this.cartService.getCurrentCart(user.id);
  }

  @Post('items')
  async addItem(@CurrentUser() user: User, @Body() dto: AddCartItemDto): Promise<CartResponse> {
    return this.cartService.addItem(user.id, dto);
  }

  @Patch('items/:id/quantity')
  async updateQuantity(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemQuantityDto,
  ): Promise<CartResponse> {
    return this.cartService.updateItemQuantity(user.id, id, dto);
  }

  @Delete('items/:id')
  async removeItem(@CurrentUser() user: User, @Param('id') id: string): Promise<CartResponse> {
    return this.cartService.removeItem(user.id, id);
  }
}
