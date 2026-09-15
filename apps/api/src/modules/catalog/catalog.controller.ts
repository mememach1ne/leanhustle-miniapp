import type { CatalogListResponse } from '@lean-poizon/shared';
import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CatalogService } from './catalog.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { CatalogSearchQueryDto } from './dto/catalog-search-query.dto';

@Controller('catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  private readonly catalogService: CatalogService;

  constructor(@Inject(CatalogService) catalogService: CatalogService) {
    this.catalogService = catalogService;
  }

  @Get()
  async list(@Query() query: CatalogQueryDto): Promise<CatalogListResponse> {
    return this.catalogService.list(query.page ?? 1, query.limit ?? 30, query.sort ?? 'popular');
  }

  /** Фильтры/поиск — brand/type chips и/или свободный текст. */
  @Get('search')
  async search(@Query() query: CatalogSearchQueryDto): Promise<CatalogListResponse> {
    return this.catalogService.search(
      query.brand,
      query.type,
      query.q,
      query.page ?? 1,
      query.limit ?? 30,
    );
  }
}
