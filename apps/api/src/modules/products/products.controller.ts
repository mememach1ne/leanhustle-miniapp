import type { DewuResolvedProduct } from '@lean-poizon/shared';
import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResolveProductDto } from './dto/resolve-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  private readonly productsService: ProductsService;

  constructor(@Inject(ProductsService) productsService: ProductsService) {
    this.productsService = productsService;
  }

  @Post('resolve')
  @Throttle({
    short: { ttl: 60_000, limit: 5 },
    long: { ttl: 86_400_000, limit: 20 },
  })
  async resolveProduct(
    @Body() dto: ResolveProductDto,
    @CurrentUser() _user: User,
  ): Promise<DewuResolvedProduct> {
    return this.productsService.resolveProduct(dto);
  }
}
