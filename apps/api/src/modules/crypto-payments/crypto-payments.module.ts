import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { CryptoPaymentsController } from './crypto-payments.controller';
import { BybitClientService } from './services/bybit-client.service';
import { CryptoPaymentService } from './services/crypto-payment.service';

@Module({
  // OrdersModule re-exports OrderNotificationsService via its providers,
  // but to avoid a circular import we re-construct the dependency here.
  imports: [AuthModule, OrdersModule],
  controllers: [CryptoPaymentsController],
  providers: [BybitClientService, CryptoPaymentService],
  exports: [CryptoPaymentService],
})
export class CryptoPaymentsModule {}
