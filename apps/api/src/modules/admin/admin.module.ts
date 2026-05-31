import { Module } from '@nestjs/common';

import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { SettingsModule } from '../settings/settings.module';
import { StaffModule } from '../staff/staff.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AnalyticsService } from './services/analytics.service';
import { ExcelExportService } from './services/excel-export.service';

@Module({
  imports: [OrdersModule, ProductsModule, SettingsModule, StaffModule],
  controllers: [AdminController],
  providers: [AdminService, AnalyticsService, ExcelExportService],
})
export class AdminModule {}
