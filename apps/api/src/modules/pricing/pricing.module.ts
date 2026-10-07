import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { SettingsModule } from '../settings/settings.module';
import { StaffModule } from '../staff/staff.module';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { StaffDeliveryCategoriesController } from './staff-delivery-categories.controller';
import { DeliveryCategoryWeightService } from './services/delivery-category-weight.service';
import { DeliveryEstimationService } from './services/delivery-estimation.service';
import { DutyCalculationService } from './services/duty-calculation.service';
import { ManagerHelpNotificationService } from './services/manager-help-notification.service';
import { NewCategoryNotificationService } from './services/new-category-notification.service';
import { ProductCategoryClassifierService } from './services/product-category-classifier.service';
import { RegionalDeliveryService } from './services/regional-delivery.service';

@Module({
  imports: [PrismaModule, AuthModule, LoyaltyModule, SettingsModule, StaffModule],
  controllers: [PricingController, StaffDeliveryCategoriesController],
  providers: [
    PricingService,
    DeliveryCategoryWeightService,
    DeliveryEstimationService,
    DutyCalculationService,
    ManagerHelpNotificationService,
    NewCategoryNotificationService,
    ProductCategoryClassifierService,
    RegionalDeliveryService,
  ],
  exports: [
    PricingService,
    DeliveryCategoryWeightService,
    NewCategoryNotificationService,
    RegionalDeliveryService,
  ],
})
export class PricingModule {}
