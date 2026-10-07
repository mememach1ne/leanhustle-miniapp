import type {
  CheckoutOrderResponse,
  DeliveryPaymentLinkResponse,
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
import { RaketaDeliveryPaymentService } from './services/raketa-delivery-payment.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  private readonly ordersService: OrdersService;
  private readonly deliveryPayment: RaketaDeliveryPaymentService;

  constructor(
    @Inject(OrdersService) ordersService: OrdersService,
    @Inject(RaketaDeliveryPaymentService) deliveryPayment: RaketaDeliveryPaymentService,
  ) {
    this.ordersService = ordersService;
    this.deliveryPayment = deliveryPayment;
  }

  @Post('checkout')
  async checkout(
    @CurrentUser() user: User,
    @Body() dto: CheckoutDto,
  ): Promise<CheckoutOrderResponse> {
    return this.ordersService.checkout(user, dto.deliveryAddressId, Boolean(dto.insurance));
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

  /** RAKETA top-up link for paying delivery (fresh if the old one is stale). */
  @Post(':id/delivery-payment-link')
  async getDeliveryPaymentLink(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryPaymentLinkResponse> {
    return this.deliveryPayment.getPaymentLinkForUser(user.id, id);
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
