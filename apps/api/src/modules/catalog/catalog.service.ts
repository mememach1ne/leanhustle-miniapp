import type { CatalogListResponse, CatalogProductDto } from '@lean-poizon/shared';
import { buildCatalogKeyword } from '@lean-poizon/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CatalogProduct, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CatalogSyncService } from './services/catalog-sync.service';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private readonly prisma: PrismaService;
  private readonly catalogSyncService: CatalogSyncService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(CatalogSyncService) catalogSyncService: CatalogSyncService,
  ) {
    this.prisma = prisma;
    this.catalogSyncService = catalogSyncService;
  }

  /**
   * Reads the "Популярное" shelf straight from CatalogProduct — never
   * touches the price engine. CatalogSyncService is the only writer.
   * Restricted to rows with a real popularityOrder (i.e. actually present
   * in the last /catalog feed pass) so keyword-only search results never
   * leak into this tab.
   */
  async list(
    pageInput: number,
    limitInput: number,
    sort: 'popular' | 'sold',
  ): Promise<CatalogListResponse> {
    // class-transformer's @Transform on the query DTO doesn't fire under
    // tsx/esbuild (no emitDecoratorMetadata → Nest can't resolve the DTO's
    // design:paramtypes, so ValidationPipe treats it as a plain Object and
    // skips transformation) — query.page/limit arrive as raw strings. Coerce
    // defensively here, same pattern as AdminService.getOrders.
    // DTO-level @Min/@Max validation is skipped for the same reason (see
    // above), so also clamp here — a client-supplied limit shouldn't be
    // able to force an unbounded findMany().
    const page = Math.max(1, Number(pageInput) || 1);
    const limit = Math.min(60, Math.max(1, Number(limitInput) || 30));
    const skip = (page - 1) * limit;
    const where: Prisma.CatalogProductWhereInput = {
      isActive: true,
      popularityOrder: { not: null },
    };
    const orderBy: Prisma.CatalogProductOrderByWithRelationInput =
      sort === 'sold' ? { soldRank: 'desc' } : { popularityOrder: 'asc' };

    const [rows, total] = await Promise.all([
      this.prisma.catalogProduct.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.catalogProduct.count({ where }),
    ]);

    const items = rows.map(mapCatalogProduct);

    return {
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    };
  }

  /**
   * Фильтры/поиск (brand/type chips + free text — see
   * docs/SHOP_MVP_PLAN.md §"Фильтры и поиск (v2)"). Serves from the DB
   * snapshot (rows tagged with this exact keyword by the nightly sync).
   * On a cache miss — the combo isn't part of the curated keyword list, or
   * hasn't synced yet — falls back to a live engine call and tags the
   * result for next time. Sorted by soldRank (Best Sellers), matching what
   * the engine's /search already returns.
   */
  async search(
    brand: string | undefined,
    type: string | undefined,
    q: string | undefined,
    pageInput: number,
    limitInput: number,
  ): Promise<CatalogListResponse> {
    const page = Math.max(1, Number(pageInput) || 1);
    const limit = Math.min(60, Math.max(1, Number(limitInput) || 30));
    const keyword = buildCatalogKeyword([brand, type, q]);

    if (!keyword) {
      return { items: [], page, limit, total: 0, hasMore: false };
    }

    let rows = await this.findByKeyword(keyword);

    if (rows.length === 0) {
      this.logger.debug(`Catalog search cache miss for "${keyword}" — live fallback`);
      try {
        await this.catalogSyncService.syncKeywordNow(keyword);
        rows = await this.findByKeyword(keyword);
      } catch (error) {
        this.logger.warn(
          `Catalog live search fallback failed for "${keyword}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        // Engine unavailable — return an empty (not error) result; the
        // frontend shows "ничего не найдено" rather than a hard failure.
        return { items: [], page, limit, total: 0, hasMore: false };
      }
    }

    const total = rows.length;
    const skip = (page - 1) * limit;
    const items = rows.slice(skip, skip + limit).map(mapCatalogProduct);

    return {
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    };
  }

  private findByKeyword(keyword: string): Promise<CatalogProduct[]> {
    return this.prisma.catalogProduct.findMany({
      where: { isActive: true, keywords: { has: keyword } },
      orderBy: { soldRank: 'desc' },
    });
  }
}

function mapCatalogProduct(row: CatalogProduct): CatalogProductDto {
  return {
    spuId: row.spuId,
    title: row.title,
    article: row.article,
    imageUrl: row.imageUrl,
    priceUsd: Number(row.priceUsd),
    priceCny: Number(row.priceCny),
    soldText: row.soldText,
    soldRank: row.soldRank,
  };
}
