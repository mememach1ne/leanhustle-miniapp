import type { CatalogSortKey } from '@lean-poizon/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CatalogSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(['best', 'price_asc', 'price_desc'])
  sort?: CatalogSortKey = 'best';

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
}
