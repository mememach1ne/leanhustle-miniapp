import type { CatalogSortKey } from '@lean-poizon/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CatalogQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number = 30;

  @IsOptional()
  @IsIn(['best', 'price_asc', 'price_desc'])
  sort?: CatalogSortKey = 'best';
}
