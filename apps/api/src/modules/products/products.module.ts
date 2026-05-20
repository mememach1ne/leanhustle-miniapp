import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { DewuApiClientService } from './services/dewu-api-client.service';
import { DewuLinkResolverService } from './services/dewu-link-resolver.service';
import { DewuProductMapperService } from './services/dewu-product-mapper.service';
import { ProductCacheService } from './services/product-cache.service';
import { ProductRateLimitService } from './services/product-rate-limit.service';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    DewuLinkResolverService,
    DewuApiClientService,
    DewuProductMapperService,
    ProductCacheService,
    ProductRateLimitService,
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
