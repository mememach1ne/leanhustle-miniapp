import type {
  CheckoutOrderResponse,
  OrderDetailsDto,
  OrderListItemDto,
} from '@lean-poizon/shared';
import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  private readonly ordersService: OrdersService;

  constructor(@Inject(OrdersService) ordersService: OrdersService) {
    this.ordersService = ordersService;
  }

  @Post('checkout')
  async checkout(
    @CurrentUser() user: User,
    @Body() dto: CheckoutDto,
  ): Promise<CheckoutOrderResponse> {
    return this.ordersService.checkout(user, dto.deliveryAddressId);
  }

  @Get()
  async getCurrentUserOrders(@CurrentUser() user: User): Promise<OrderListItemDto[]> {
    return this.ordersService.getCurrentUserOrders(user.id);
  }

  @Get(':id')
  async getCurrentUserOrderById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderDetailsDto> {
    return this.ordersService.getCurrentUserOrderById(user.id, id);
  }

  @Post(':id/cancel')
  async cancelOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderDetailsDto> {
    return this.ordersService.cancelByClient(user, id, dto.reason);
  }
}
