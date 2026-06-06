import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class AdminOrdersQueryDto {
  @IsOptional()
  @IsIn(['active', 'completed', 'cancelled'])
  status?: 'active' | 'completed' | 'cancelled' = 'active';

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;
}

export class AdminOrdersSearchQueryDto {
  @IsString()
  q!: string;
}
