import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class CalculatePricingSkuDto {
  @IsString()
  @IsNotEmpty()
  dwSkuId!: string;

  @IsString()
  @IsNotEmpty()
  size!: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsNumber()
  minBidPrice!: number;

  @IsBoolean()
  isAvailable!: boolean;

  @IsOptional()
  @IsNumber()
  priceYuan!: number | null;
}

class CalculatePricingProductDto {
  @IsString()
  @IsNotEmpty()
  dwSpuId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  categoryL1?: string;

  @IsOptional()
  @IsString()
  categoryL2?: string;

  @IsOptional()
  @IsString()
  categoryL3?: string;

  @ValidateNested({ each: true })
  @Type(() => CalculatePricingSkuDto)
  @IsArray()
  skus!: CalculatePricingSkuDto[];
}

export class CalculatePricingDto {
  @ValidateNested()
  @Type(() => CalculatePricingProductDto)
  product!: CalculatePricingProductDto;

  @IsString()
  @IsNotEmpty()
  dwSkuId!: string;
}
