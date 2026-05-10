import { IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  dewuProductId?: string;
}
