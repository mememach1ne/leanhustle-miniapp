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
   * Opens a product straight from a known dwSpuId — used by the "Магазин"
   * storefront, whose cards already carry the spuId from our own DB
   * (CatalogProduct), so there's no link to resolve. Bypasses
   * DewuLinkResolverService and the per-user rate limit: catalog items are
   * curated by us (synced from the engine), not arbitrary user-submitted
   * links, so this traffic doesn't burn the same quota. Cache still applies.
   */
  async resolveBySpuId(spuId: string, user: User): Promise<DewuResolvedProduct> {
    // Catalog items have no original share link (we only have the spuId from
    // the engine's /catalog feed). Synthesize a canonical, valid Poizon URL
    // so downstream code (add-to-cart's dewuLink, shown to staff on the
    // order) has something real to store — no special-casing needed there.
    const syntheticLink = `https://www.poizon.com/product/detail?spuId=${encodeURIComponent(spuId)}`;

    if (this.demoTelegramIds.includes(String(user.telegramId))) {
      this.logger.log(`Demo product served (catalog) to telegramId=${user.telegramId}`);
      return this.dewuProductMapperService.mapProduct(DEMO_PRODUCT_FIXTURE, {
        originalLink: syntheticLink,
        resolvedUrl: syntheticLink,
        dwSpuId: '2827430',
      });
    }

    const cached = await this.cacheService.get(spuId);
    if (cached) {
      this.logger.debug(`[catalog] Cache hit for dwSpuId=${spuId}`);
      return { ...cached, originalLink: syntheticLink };
    }

    const rawProduct = await this.dewuApiClientService.queryProductDetail(spuId);
    const product = this.dewuProductMapperService.mapProduct(rawProduct, {
      originalLink: syntheticLink,
      resolvedUrl: syntheticLink,
      dwSpuId: spuId,
    });

    await this.cacheService.set(spuId, product);

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
