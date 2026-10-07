import { DeliveryCategory } from '@lean-poizon/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

import { PickupPointDto } from '../../delivery-addresses/dto/pickup-point.dto';

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

  @IsOptional()
  @IsEnum(DeliveryCategory)
  deliveryCategory?: DeliveryCategory;

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

  @IsOptional()
  @IsString()
  @MaxLength(64)
  dwSpuId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  productImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  titleCn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  categoryL1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  categoryL2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  categoryL3?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  chinaTrackNumber?: string;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => PickupPointDto)
  pickupPoint?: PickupPointDto;
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

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent?: number;

  @IsOptional()
  @IsBoolean()
  insurance?: boolean;

  @IsOptional()
  @IsBoolean()
  alreadyPaid?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  raketaTitle?: string;
}
