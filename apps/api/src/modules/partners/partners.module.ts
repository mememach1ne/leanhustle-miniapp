import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { StaffModule } from '../staff/staff.module';
import { BybitWithdrawClient } from './bybit-withdraw.client';
import { LedgerService } from './ledger.service';
import { PartnersAdminController, ReferralController, ReferralInternalController } from './partners.controller';
import { ProfitService } from './profit.service';
import { ReferralService } from './referral.service';

/** Referral program + partners' profit ledger and Bybit withdrawals. */
@Module({
  imports: [AuthModule, OrdersModule, SettingsModule, StaffModule],
  controllers: [ReferralController, ReferralInternalController, PartnersAdminController],
  providers: [BybitWithdrawClient, LedgerService, ProfitService, ReferralService],
})
export class PartnersModule {}
