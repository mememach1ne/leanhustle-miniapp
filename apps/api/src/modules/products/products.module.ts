import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { DewuApiClientService } from './services/dewu-api-client.service';
import { DewuLinkResolverService } from './services/dewu-link-resolver.service';
import { DewuProductMapperService } from './services/dewu-product-mapper.service';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    DewuLinkResolverService,
    DewuApiClientService,
    DewuProductMapperService,
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
