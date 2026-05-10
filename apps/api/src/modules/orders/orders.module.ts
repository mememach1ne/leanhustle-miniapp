import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { StaffModule } from '../staff/staff.module';
import { UsersModule } from '../users/users.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderNotificationsService } from './services/order-notifications.service';
import { OrderNumberService } from './services/order-number.service';
import { SubscriberBenefitService } from './services/subscriber-benefit.service';
import { StaffOrdersController } from './staff-orders.controller';

@Module({
  imports: [AuthModule, SettingsModule, StaffModule, UsersModule],
  controllers: [OrdersController, StaffOrdersController],
  providers: [
    OrdersService,
    OrderNumberService,
    OrderNotificationsService,
    SubscriberBenefitService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
