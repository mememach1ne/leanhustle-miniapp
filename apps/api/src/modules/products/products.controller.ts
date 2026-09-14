import type { DewuResolvedProduct } from '@lean-poizon/shared';
import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
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
  // Rate limiting is enforced inside the service so staff can bypass it
  // and so cache hits don't count against the quota.
  async resolveProduct(
    @Body() dto: ResolveProductDto,
    @CurrentUser() user: User,
  ): Promise<DewuResolvedProduct> {
    return this.productsService.resolveProduct(dto, user);
  }

  /** Opens a card from the "Магазин" storefront — spuId is already known, no link to parse. */
  @Get('by-spu-id/:spuId')
  async resolveBySpuId(
    @Param('spuId') spuId: string,
    @CurrentUser() user: User,
  ): Promise<DewuResolvedProduct> {
    return this.productsService.resolveBySpuId(spuId, user);
  }
}
