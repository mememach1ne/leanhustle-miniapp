import type {
  AdminAnalyticsResponse,
  AdminOrdersResponse,
  AdminUserDetailDto,
  AdminUsersResponse,
  BusinessSettingsDto,
  DewuResolvedProduct,
  ManualOrderClientLookupResponse,
  SettingsAuditLogItemDto,
  StaffOrderDetailsDto,
  StaffOrderListItemDto,
  UpdateBusinessSettingsRequest,
} from '@lean-poizon/shared';
import {
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { StaffAccount } from '@prisma/client';
import type { Response } from 'express';

import { CancelOrderDto } from '../orders/dto/cancel-order.dto';
import { CreateManualOrderDto } from '../orders/dto/create-manual-order.dto';
import { SetActualDeliveryDto, SetActualDutyDto } from '../orders/dto/set-actual-amount.dto';
import { UpdateOrderStatusDto } from '../orders/dto/update-order-status.dto';
import { UpdateOrderTrackCodeDto } from '../orders/dto/update-order-track-code.dto';
import { OrdersService } from '../orders/orders.service';
import { ResolveProductDto } from '../products/dto/resolve-product.dto';
import { ProductsService } from '../products/products.service';
import { UpdateSettingsDto } from '../settings/dto/update-settings.dto';
import { SettingsService } from '../settings/settings.service';
import { CurrentStaff } from '../staff/decorators/current-staff.decorator';
import { JwtStaffAuthGuard } from '../staff/guards/jwt-staff-auth.guard';
import { AdminService } from './admin.service';
import { AdminOrdersQueryDto, AdminOrdersSearchQueryDto } from './dto/admin-orders-query.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AnalyticsService } from './services/analytics.service';
import { ExcelExportService } from './services/excel-export.service';

@Controller('admin')
@UseGuards(JwtStaffAuthGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);
  private readonly adminService: AdminService;
  private readonly ordersService: OrdersService;
  private readonly settingsService: SettingsService;
  private readonly excelExportService: ExcelExportService;
  private readonly analyticsService: AnalyticsService;
  private readonly productsService: ProductsService;

  constructor(
    @Inject(AdminService) adminService: AdminService,
    @Inject(OrdersService) ordersService: OrdersService,
    @Inject(SettingsService) settingsService: SettingsService,
    @Inject(ExcelExportService) excelExportService: ExcelExportService,
    @Inject(AnalyticsService) analyticsService: AnalyticsService,
    @Inject(ProductsService) productsService: ProductsService,
  ) {
    this.adminService = adminService;
    this.ordersService = ordersService;
    this.settingsService = settingsService;
    this.excelExportService = excelExportService;
    this.analyticsService = analyticsService;
    this.productsService = productsService;
  }

  // ─── Analytics ─────────────────────────────────────────────

  @Get('analytics')
  async getAnalytics(): Promise<AdminAnalyticsResponse> {
    return this.analyticsService.getActivity();
  }

  // ─── Orders ────────────────────────────────────────────────

  @Get('orders')
  async getOrders(@Query() query: AdminOrdersQueryDto): Promise<AdminOrdersResponse> {
    try {
      return await this.adminService.getOrders(
        query.status ?? 'active',
        query.page ?? 1,
        query.pageSize ?? 20,
      );
    } catch (error) {
      this.logger.error(
        `GET /admin/orders failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Post('orders/manual')
  async createManualOrder(
    @Body() dto: CreateManualOrderDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.createManualOrderByStaff(staff, dto);
  }

  @Get('orders/manual/lookup-client')
  async lookupManualOrderClient(
    @Query('username') username: string,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<ManualOrderClientLookupResponse> {
    return this.ordersService.lookupManualOrderClient(staff, username);
  }

  @Post('orders/manual/resolve-product')
  async resolveManualOrderProduct(
    @Body() dto: ResolveProductDto,
  ): Promise<DewuResolvedProduct> {
    return this.productsService.resolveProductForStaff(dto);
  }

  @Get('orders/search')
  async searchOrders(
    @Query() query: AdminOrdersSearchQueryDto,
  ): Promise<StaffOrderListItemDto[]> {
    return this.adminService.searchOrders(query.q);
  }

  @Get('orders/:id')
  async getOrderById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffOrderDetailsDto> {
    return this.adminService.getOrderById(id);
  }

  @Post('orders/:id/status')
  async updateOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.updateStatusByStaff(id, dto.status, staff);
  }

  @Post('orders/:id/track-code')
  async setTrackCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderTrackCodeDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.setTrackCodeByStaff(id, dto.trackCode, staff);
  }

  @Post('orders/:id/cancel')
  async cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.cancelByStaff(id, staff, dto.reason);
  }

  // ─── Phase 2: actual delivery / duty cycle ─────────────────

  @Post('orders/:id/actual-delivery')
  async setActualDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActualDeliveryDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.setActualDeliveryByStaff(id, dto.actualDeliveryRub, staff);
  }

  @Post('orders/:id/mark-delivery-paid')
  async markDeliveryPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.markDeliveryPaidByStaff(id, staff);
  }

  @Post('orders/:id/actual-duty')
  async setActualDuty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActualDutyDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.setActualDutyByStaff(id, dto.actualDutyRub, staff);
  }

  @Post('orders/:id/mark-duty-paid')
  async markDutyPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.markDutyPaidByStaff(id, staff);
  }

  @Post('orders/:id/mark-delivered')
  async markDelivered(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    return this.ordersService.markDeliveredByStaff(id, staff);
  }

  // ─── Settings ──────────────────────────────────────────────

  @Get('settings')
  async getSettings(): Promise<BusinessSettingsDto> {
    return this.settingsService.getCurrentSettingsDto();
  }

  @Patch('settings')
  async updateSettings(
    @Body() dto: UpdateSettingsDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<BusinessSettingsDto> {
    return this.settingsService.updateByStaff(dto as UpdateBusinessSettingsRequest, staff);
  }

  @Get('settings/audit')
  async getSettingsAudit(): Promise<SettingsAuditLogItemDto[]> {
    return this.settingsService.getAuditLogs();
  }

  // ─── Users ─────────────────────────────────────────────────

  @Get('users')
  async getUsers(@Query() query: AdminUsersQueryDto): Promise<AdminUsersResponse> {
    return this.adminService.getUsers(
      query.page ?? 1,
      query.pageSize ?? 20,
      query.filter ?? 'all',
      query.search,
      query.sortBy ?? 'createdAt',
    );
  }

  @Get('users/export-excel')
  async exportUsersExcel(@Res() res: Response): Promise<void> {
    const users = await this.adminService.getAllUsersForExport();
    const buffer = await this.excelExportService.generateUsersExcel(users);

    const filename = `users_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Get('users/:id/export-excel')
  async exportUserExcel(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { user, orders } = await this.adminService.getUserOrdersForExport(id);
    const buffer = await this.excelExportService.generateUserOrdersExcel(
      user,
      orders,
    );

    const username = user.username ?? user.telegramId;
    const filename = `orders_${username}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Get('users/:id')
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminUserDetailDto> {
    return this.adminService.getUserById(id);
  }
}
