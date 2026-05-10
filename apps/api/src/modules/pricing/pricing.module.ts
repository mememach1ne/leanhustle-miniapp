import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { DeliveryEstimationService } from './services/delivery-estimation.service';
import { DutyCalculationService } from './services/duty-calculation.service';
import { ManagerHelpNotificationService } from './services/manager-help-notification.service';
import { ProductCategoryClassifierService } from './services/product-category-classifier.service';

@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [PricingController],
  providers: [
    PricingService,
    DeliveryEstimationService,
    DutyCalculationService,
    ManagerHelpNotificationService,
    ProductCategoryClassifierService,
  ],
  exports: [PricingService],
})
export class PricingModule {}
