import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PricingModule } from '../pricing/pricing.module';
import { ProductsModule } from '../products/products.module';
import { RaketaModule } from '../raketa/raketa.module';
import { SettingsModule } from '../settings/settings.module';
import { StaffModule } from '../staff/staff.module';
import { UsersModule } from '../users/users.module';
import { OrderClaimController } from './order-claim.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderNotificationsService } from './services/order-notifications.service';
import { OrderNumberService } from './services/order-number.service';
import { RaketaDeliveryPaymentService } from './services/raketa-delivery-payment.service';
import { RaketaFulfillmentService } from './services/raketa-fulfillment.service';
import { StaffOrdersController } from './staff-orders.controller';

@Module({
  imports: [
    AuthModule,
    LoyaltyModule,
    PricingModule,
    ProductsModule,
    RaketaModule,
    SettingsModule,
    StaffModule,
    UsersModule,
  ],
  controllers: [OrdersController, StaffOrdersController, OrderClaimController],
  providers: [
    OrdersService,
    OrderNumberService,
    OrderNotificationsService,
    RaketaFulfillmentService,
    RaketaDeliveryPaymentService,
  ],
  exports: [
    OrdersService,
    OrderNotificationsService,
    RaketaFulfillmentService,
    RaketaDeliveryPaymentService,
  ],
})
export class OrdersModule {}
