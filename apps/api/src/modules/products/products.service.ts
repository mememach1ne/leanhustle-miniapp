import type { DewuResolvedProduct } from '@lean-poizon/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { User } from '@prisma/client';

import { ResolveProductDto } from './dto/resolve-product.dto';
import { DewuApiClientService } from './services/dewu-api-client.service';
import { DewuLinkResolverService } from './services/dewu-link-resolver.service';
import { DewuProductMapperService } from './services/dewu-product-mapper.service';
import { ProductCacheService } from './services/product-cache.service';
import { ProductRateLimitService } from './services/product-rate-limit.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly dewuLinkResolverService: DewuLinkResolverService;
  private readonly dewuApiClientService: DewuApiClientService;
  private readonly dewuProductMapperService: DewuProductMapperService;
  private readonly cacheService: ProductCacheService;
  private readonly rateLimitService: ProductRateLimitService;

  constructor(
    @Inject(DewuLinkResolverService)
    dewuLinkResolverService: DewuLinkResolverService,
    @Inject(DewuApiClientService) dewuApiClientService: DewuApiClientService,
    @Inject(DewuProductMapperService)
    dewuProductMapperService: DewuProductMapperService,
    @Inject(ProductCacheService) cacheService: ProductCacheService,
    @Inject(ProductRateLimitService) rateLimitService: ProductRateLimitService,
  ) {
    this.dewuLinkResolverService = dewuLinkResolverService;
    this.dewuApiClientService = dewuApiClientService;
    this.dewuProductMapperService = dewuProductMapperService;
    this.cacheService = cacheService;
    this.rateLimitService = rateLimitService;
  }

  async resolveProduct(dto: ResolveProductDto, user: User): Promise<DewuResolvedProduct> {
    const resolvedLink = await this.dewuLinkResolverService.resolve(dto.link);
    const cacheKey = resolvedLink.dwSpuId;

    // Cache hit doesn't burn the API quota and isn't rate-limited.
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for dwSpuId=${cacheKey}`);
      return { ...cached, originalLink: dto.link };
    }

    // Cache miss → real external API call. Check the user's quota first.
    await this.rateLimitService.assertAllowed(user.id, user.telegramId);

    const rawProduct = await this.dewuApiClientService.queryProductDetail(cacheKey);
    const product = this.dewuProductMapperService.mapProduct(rawProduct, resolvedLink);

    // Persist cache + record the API hit for rate-limiting purposes.
    await Promise.all([
      this.cacheService.set(cacheKey, product),
      this.rateLimitService.recordApiHit(user.id, cacheKey),
    ]);

    return product;
  }
}
