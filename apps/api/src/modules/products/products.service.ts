import type { DewuResolvedProduct } from '@lean-poizon/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';

import { ResolveProductDto } from './dto/resolve-product.dto';
import { DEMO_PRODUCT_FIXTURE } from './fixtures/demo-product.fixture';
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
  private readonly demoTelegramIds: string[];

  constructor(
    @Inject(DewuLinkResolverService)
    dewuLinkResolverService: DewuLinkResolverService,
    @Inject(DewuApiClientService) dewuApiClientService: DewuApiClientService,
    @Inject(DewuProductMapperService)
    dewuProductMapperService: DewuProductMapperService,
    @Inject(ProductCacheService) cacheService: ProductCacheService,
    @Inject(ProductRateLimitService) rateLimitService: ProductRateLimitService,
    @Inject(ConfigService) configService: ConfigService,
  ) {
    this.dewuLinkResolverService = dewuLinkResolverService;
    this.dewuApiClientService = dewuApiClientService;
    this.dewuProductMapperService = dewuProductMapperService;
    this.cacheService = cacheService;
    this.rateLimitService = rateLimitService;
    this.demoTelegramIds =
      configService.get<string[]>('demo.productTelegramIds') ?? [];
  }

  async resolveProduct(dto: ResolveProductDto, user: User): Promise<DewuResolvedProduct> {
    // Demo mode: allow-listed users (owner + investor) get a canned product
    // for any link while the paid Poizon API is unavailable.
    if (this.demoTelegramIds.includes(String(user.telegramId))) {
      this.logger.log(`Demo product served to telegramId=${user.telegramId}`);
      return this.dewuProductMapperService.mapProduct(DEMO_PRODUCT_FIXTURE, {
        originalLink: dto.link,
        resolvedUrl: dto.link,
        dwSpuId: '2827430',
      });
    }

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

  /**
   * Same as `resolveProduct` but for staff (bot / admin panel manual order flow).
   * Bypasses per-user rate limiting because staff aren't subject to it.
   */
  async resolveProductForStaff(dto: ResolveProductDto): Promise<DewuResolvedProduct> {
    const resolvedLink = await this.dewuLinkResolverService.resolve(dto.link);
    const cacheKey = resolvedLink.dwSpuId;

    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`[staff] Cache hit for dwSpuId=${cacheKey}`);
      return { ...cached, originalLink: dto.link };
    }

    const rawProduct = await this.dewuApiClientService.queryProductDetail(cacheKey);
    const product = this.dewuProductMapperService.mapProduct(rawProduct, resolvedLink);

    await this.cacheService.set(cacheKey, product);

    return product;
  }
}
