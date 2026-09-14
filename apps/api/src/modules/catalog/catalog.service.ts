import type { CatalogListResponse, CatalogProductDto } from '@lean-poizon/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { CatalogProduct, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  /**
   * Reads the storefront shelf straight from CatalogProduct — never touches
   * the price engine. CatalogSyncService is the only writer.
   */
  async list(
    page: number,
    limit: number,
    sort: 'popular' | 'sold',
  ): Promise<CatalogListResponse> {
    const skip = (page - 1) * limit;
    const orderBy: Prisma.CatalogProductOrderByWithRelationInput =
      sort === 'sold' ? { soldRank: 'desc' } : { popularityOrder: 'asc' };

    const [rows, total] = await Promise.all([
      this.prisma.catalogProduct.findMany({
        where: { isActive: true },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.catalogProduct.count({ where: { isActive: true } }),
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
}

function mapCatalogProduct(row: CatalogProduct): CatalogProductDto {
  return {
    spuId: row.spuId,
    title: row.title,
    article: row.article,
    imageUrl: row.imageUrl,
    priceRub: Number(row.priceRub),
    priceCny: Number(row.priceCny),
    soldText: row.soldText,
  };
}
