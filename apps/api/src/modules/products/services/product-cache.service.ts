import type { DewuResolvedProduct } from '@lean-poizon/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

@Injectable()
export class ProductCacheService {
  private readonly logger = new Logger(ProductCacheService.name);
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  /** Returns cached payload if fresh, otherwise null. */
  async get(dwSpuId: string): Promise<DewuResolvedProduct | null> {
    const row = await this.prisma.productCache.findUnique({ where: { dwSpuId } });
    if (!row) return null;

    if (row.expiresAt.getTime() <= Date.now()) {
      // Lazy cleanup: drop stale row when we hit it. Production-volume
      // cleanup can be moved to a cron later.
      this.prisma.productCache
        .delete({ where: { dwSpuId } })
        .catch((err) => this.logger.warn(`Cleanup of stale cache failed: ${err}`));
      return null;
    }

    return row.payload as unknown as DewuResolvedProduct;
  }

  /** Upsert a fresh cache entry. */
  async set(dwSpuId: string, payload: DewuResolvedProduct): Promise<void> {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    await this.prisma.productCache.upsert({
      where: { dwSpuId },
      create: {
        dwSpuId,
        payload: payload as unknown as object,
        expiresAt,
      },
      update: {
        payload: payload as unknown as object,
        cachedAt: new Date(),
        expiresAt,
      },
    });
  }
}
