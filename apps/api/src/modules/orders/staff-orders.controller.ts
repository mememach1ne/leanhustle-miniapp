import type { StaffOrderDetailsDto, StaffOrderListItemDto } from '@lean-poizon/shared';
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { StaffAccount } from '@prisma/client';

import { CurrentStaff } from '../staff/decorators/current-staff.decorator';
import { StaffBotAuthGuard } from '../staff/guards/staff-bot-auth.guard';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { SetActualDeliveryDto, SetActualDutyDto } from './dto/set-actual-amount.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderTrackCodeDto } from './dto/update-order-track-code.dto';
import { OrdersService } from './orders.service';

@Controller('staff/orders')
@UseGuards(StaffBotAuthGuard)
export class StaffOrdersController {
  private readonly ordersService: OrdersService;

  constructor(@Inject(OrdersService) ordersService: OrdersService) {
    this.ordersService = ordersService;
  }

  @Get('new')
  async getNewOrders(): Promise<StaffOrderListItemDto[]> {
    return this.ordersService.getNewOrdersForStaff();
  }

  @Get('active')
  async getActiveOrders(): Promise<StaffOrderListItemDto[]> {
    return this.ordersService.getActiveOrdersForStaff();
  }

  @Get('search')
  async searchByOrderNumber(
    @Query('orderNumber') orderNumber: string,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.findOrderForStaffByNumber(orderNumber);
  }

  @Get('search-by-user')
  async searchByUser(
    @Query('query') query: string,
  ): Promise<StaffOrderListItemDto[]> {
    return this.ordersService.findOrdersForStaffByUser(query);
  }

  @Get(':id')
  async getOrderById(@Param('id', ParseUUIDPipe) id: string): Promise<StaffOrderDetailsDto> {
    return this.ordersService.getOrderForStaff(id);
  }

  @Post(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.updateStatusByStaff(id, dto.status, staff);
  }

  @Post(':id/track-code')
  async updateTrackCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderTrackCodeDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.setTrackCodeByStaff(id, dto.trackCode, staff);
  }

  // --- Phase 2: actual delivery / duty cycle ---

  @Post(':id/actual-delivery')
  async setActualDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActualDeliveryDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.setActualDeliveryByStaff(id, dto.actualDeliveryRub, staff);
  }

  @Post(':id/mark-delivery-paid')
  async markDeliveryPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.markDeliveryPaidByStaff(id, staff);
  }

  @Post(':id/actual-duty')
  async setActualDuty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActualDutyDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.setActualDutyByStaff(id, dto.actualDutyRub, staff);
  }

  @Post(':id/mark-duty-paid')
  async markDutyPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.markDutyPaidByStaff(id, staff);
  }

  @Post(':id/mark-delivered')
  async markDelivered(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.markDeliveredByStaff(id, staff);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.cancelByStaff(id, staff, dto.reason);
  }
}
