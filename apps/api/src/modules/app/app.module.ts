import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { ClientIpThrottlerGuard } from '../../common/guards/client-ip-throttler.guard';
import appConfig from '../../config/app.config';
import { validateEnv } from '../../config/env.validation';
import { getEnvFilePaths } from '../../config/env-file-paths';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CryptoPaymentsModule } from '../crypto-payments/crypto-payments.module';
import { DeliveryAddressesModule } from '../delivery-addresses/delivery-addresses.module';
import { HealthModule } from '../health/health.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { OrdersModule } from '../orders/orders.module';
import { PartnersModule } from '../partners/partners.module';
import { PricingModule } from '../pricing/pricing.module';
import { ProductsModule } from '../products/products.module';
import { SettingsModule } from '../settings/settings.module';
import { StaffModule } from '../staff/staff.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePaths(),
      load: [appConfig],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      // Per client IP (see ClientIpThrottlerGuard). Mobile carriers put many
      // users behind one IP, so keep headroom above a single active session.
      {
        name: 'short',
        ttl: 60_000,
        limit: 120,
      },
      {
        name: 'long',
        ttl: 600_000,
        limit: 1000,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    StaffModule,
    UsersModule,
    ProductsModule,
    CartModule,
    CatalogModule,
    DeliveryAddressesModule,
    OrdersModule,
    CryptoPaymentsModule,
    PartnersModule,
    PricingModule,
    SettingsModule,
    LoyaltyModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ClientIpThrottlerGuard,
    },
  ],
})
export class AppModule {}
