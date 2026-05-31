import { DeliveryCategory } from '@lean-poizon/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateManualOrderItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  dewuLink?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  productTitle!: string;

  @IsNumber()
  @Min(1)
  priceYuan!: number;

  @IsEnum(DeliveryCategory)
  deliveryCategory!: DeliveryCategory;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sizeLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  versionLabel?: string;

  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;
}

export class CreateManualOrderDeliveryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  fullName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  cdekAddress!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  comment?: string;
}

export class CreateManualOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  username!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateManualOrderItemDto)
  items!: CreateManualOrderItemDto[];

  @ValidateNested()
  @Type(() => CreateManualOrderDeliveryDto)
  delivery!: CreateManualOrderDeliveryDto;
}
