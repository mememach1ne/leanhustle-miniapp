import type { DewuResolvedProduct } from '@lean-poizon/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { ResolveProductDto } from './dto/resolve-product.dto';
import { DewuApiClientService } from './services/dewu-api-client.service';
import { DewuLinkResolverService } from './services/dewu-link-resolver.service';
import { DewuProductMapperService } from './services/dewu-product-mapper.service';

interface CachedProduct {
  data: DewuResolvedProduct;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_SIZE = 200;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly dewuLinkResolverService: DewuLinkResolverService;
  private readonly dewuApiClientService: DewuApiClientService;
  private readonly dewuProductMapperService: DewuProductMapperService;
  private readonly cache = new Map<string, CachedProduct>();

  constructor(
    @Inject(DewuLinkResolverService)
    dewuLinkResolverService: DewuLinkResolverService,
    @Inject(DewuApiClientService) dewuApiClientService: DewuApiClientService,
    @Inject(DewuProductMapperService)
    dewuProductMapperService: DewuProductMapperService,
  ) {
    this.dewuLinkResolverService = dewuLinkResolverService;
    this.dewuApiClientService = dewuApiClientService;
    this.dewuProductMapperService = dewuProductMapperService;
  }

  async resolveProduct(dto: ResolveProductDto): Promise<DewuResolvedProduct> {
    const resolvedLink = await this.dewuLinkResolverService.resolve(dto.link);

    // For short links (dw4.co), query RapidAPI by link directly
    // because dw4.co is unreachable from non-Chinese servers
    const isShortLink = resolvedLink.dwSpuId === '__short_link__';

    // Try cache first (only works for resolved spuIds)
    if (!isShortLink) {
      const cached = this.cache.get(resolvedLink.dwSpuId);
      if (cached && cached.expiresAt > Date.now()) {
        this.logger.debug(`Cache hit for dwSpuId=${resolvedLink.dwSpuId}`);
        return { ...cached.data, originalLink: dto.link };
      }
    }

    const rawProduct = isShortLink
      ? await this.dewuApiClientService.queryByLink(dto.link)
      : await this.dewuApiClientService.queryProductDetail(resolvedLink.dwSpuId);

    const product = this.dewuProductMapperService.mapProduct(rawProduct, {
      originalLink: dto.link,
      resolvedUrl: resolvedLink.resolvedUrl,
      dwSpuId: isShortLink ? String(rawProduct.data?.dwSpuId ?? '') : resolvedLink.dwSpuId,
    });

    const cacheKey = product.dwSpuId;

    if (this.cache.size >= CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(cacheKey, {
      data: product,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return product;
  }
}
