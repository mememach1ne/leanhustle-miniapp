import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { CryptoPaymentsModule } from '../crypto-payments/crypto-payments.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { OrdersModule } from '../orders/orders.module';
import { PricingModule } from '../pricing/pricing.module';
import { ProductsModule } from '../products/products.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { ChatCalcInternalController } from './chat-calc-internal.controller';
import { ChatCalcService } from './chat-calc.service';

/** Multi-link price calculation in the chat with the bot (widget card). */
@Module({
  imports: [AuthModule, CartModule, CryptoPaymentsModule, LoyaltyModule, OrdersModule, PricingModule, ProductsModule, SettingsModule, UsersModule],
  controllers: [ChatCalcInternalController],
  providers: [ChatCalcService],
})
export class ChatCalcModule {}
