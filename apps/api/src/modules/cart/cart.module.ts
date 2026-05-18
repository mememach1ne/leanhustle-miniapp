import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [AuthModule, PricingModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
