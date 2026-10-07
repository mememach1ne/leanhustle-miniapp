import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { RaketaModule } from '../raketa/raketa.module';
import { DeliveryAddressesController } from './delivery-addresses.controller';
import { DeliveryAddressesService } from './delivery-addresses.service';
import { DeliveryPointsController } from './delivery-points.controller';

@Module({
  imports: [AuthModule, PricingModule, RaketaModule],
  controllers: [DeliveryAddressesController, DeliveryPointsController],
  providers: [DeliveryAddressesService],
  exports: [DeliveryAddressesService],
})
export class DeliveryAddressesModule {}
