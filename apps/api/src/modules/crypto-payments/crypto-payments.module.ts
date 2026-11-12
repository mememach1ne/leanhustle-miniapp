import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { CryptoPaymentsController } from './crypto-payments.controller';
import { BybitClientService } from './services/bybit-client.service';
import { BybitTradeClient } from './services/bybit-trade.client';
import { CryptoPaymentService } from './services/crypto-payment.service';
import { TonPayService } from './services/ton-pay.service';
import { WalletPayService } from './services/wallet-pay.service';

@Module({
  // OrdersModule re-exports OrderNotificationsService via its providers,
  // but to avoid a circular import we re-construct the dependency here.
  imports: [AuthModule, OrdersModule, SettingsModule],
  controllers: [CryptoPaymentsController],
  providers: [BybitClientService, BybitTradeClient, CryptoPaymentService, TonPayService, WalletPayService],
  exports: [CryptoPaymentService, TonPayService],
})
export class CryptoPaymentsModule {}
