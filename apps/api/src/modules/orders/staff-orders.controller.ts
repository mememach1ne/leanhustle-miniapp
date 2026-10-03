import type {
  DewuResolvedProduct,
  ManualOrderClientLookupResponse,
  StaffOrderDetailsDto,
  StaffOrderListItemDto,
} from '@lean-poizon/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { StaffAccount } from '@prisma/client';

import { ResolveProductDto } from '../products/dto/resolve-product.dto';
import { ProductsService } from '../products/products.service';
import { CurrentStaff } from '../staff/decorators/current-staff.decorator';
import { StaffBotAuthGuard } from '../staff/guards/staff-bot-auth.guard';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { SetChinaTrackDto, SetFulfillmentModeDto } from './dto/raketa-fulfillment.dto';
import { SetActualDeliveryDto, SetActualDutyDto } from './dto/set-actual-amount.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderTrackCodeDto } from './dto/update-order-track-code.dto';
import { OrdersService } from './orders.service';
import { RaketaFulfillmentService } from './services/raketa-fulfillment.service';

@Controller('staff/orders')
@UseGuards(StaffBotAuthGuard)
export class StaffOrdersController {
  private readonly ordersService: OrdersService;
  private readonly productsService: ProductsService;

  constructor(
    @Inject(OrdersService) ordersService: OrdersService,
    @Inject(ProductsService) productsService: ProductsService,
    @Inject(RaketaFulfillmentService) raketaFulfillment: RaketaFulfillmentService,
  ) {
    this.ordersService = ordersService;
    this.productsService = productsService;
    this.raketaFulfillment = raketaFulfillment;
  }

  private readonly raketaFulfillment: RaketaFulfillmentService;

  // --- RAKETA forwarder automation ---

  @Post(':id/china-track')
  async setChinaTrack(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetChinaTrackDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    if (!staff) throw new UnauthorizedException('Staff access is required.');
    return this.raketaFulfillment.registerChinaTrack(id, dto.itemId, dto.chinaTrackNumber, staff);
  }

  @Post(':id/fulfillment-mode')
  async setFulfillmentMode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetFulfillmentModeDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    if (!staff) throw new UnauthorizedException('Staff access is required.');
    return this.raketaFulfillment.setManual(id, dto.manual, staff);
  }

  @Post('manual')
  async createManualOrder(
    @Body() dto: CreateManualOrderDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.createManualOrderByStaff(staff, dto);
  }

  @Get('manual/lookup-client')
  async lookupManualOrderClient(
    @Query('username') username: string,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<ManualOrderClientLookupResponse> {
    return this.ordersService.lookupManualOrderClient(staff, username);
  }

  @Post('manual/resolve-product')
  async resolveManualOrderProduct(
    @Body() dto: ResolveProductDto,
  ): Promise<DewuResolvedProduct> {
    return this.productsService.resolveProductForStaff(dto);
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

  @Post(':id/restore')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.restoreByStaff(id, staff);
  }

  @Delete(':id')
  async deleteOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<{ ok: true; orderNumber: string }> {
    return this.ordersService.deleteOrderByStaff(id, staff);
  }
}
