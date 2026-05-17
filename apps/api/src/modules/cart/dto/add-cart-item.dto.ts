import { DeliveryCategory, ProductCategoryGroup } from '@lean-poizon/shared';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class AddCartItemDto {
  @IsUrl({}, { message: 'dewuLink должен быть валидным URL' })
  @IsNotEmpty()
  @MaxLength(2000)
  dewuLink!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  dwSpuId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  dwSkuId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  productTitle!: string;

  @IsOptional()
  @IsUrl({}, { message: 'productImage должен быть валидным URL' })
  @MaxLength(2000)
  productImage?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  size!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryL1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryL2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryL3?: string;

  @IsNumber()
  @Min(1)
  @Max(500000)
  priceYuan!: number;

  @IsNumber()
  @Min(0.01)
  @Max(100000)
  totalUsd!: number;

  @IsNumber()
  @Min(0)
  @Max(500000)
  deliveryRub!: number;

  @IsNumber()
  @Min(0)
  @Max(500000)
  dutyRub!: number;

  @IsEnum(ProductCategoryGroup)
  categoryGroup!: ProductCategoryGroup;

  @IsEnum(DeliveryCategory)
  deliveryCategory!: DeliveryCategory;

  @IsNumber()
  @Min(0.01)
  @Max(50)
  estimatedWeightKg!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  quantity?: number;
}
