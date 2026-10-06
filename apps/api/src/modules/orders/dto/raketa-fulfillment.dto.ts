import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PickupPointDto } from '../../delivery-addresses/dto/pickup-point.dto';

/** Optional recipient + CDEK point for a quick RAKETA order. */
export class RaketaQuickDeliveryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  /** Human-readable point address, e.g. "Москва, Мичуринский пр-т, 16". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  pointAddress!: string;

  @ValidateNested()
  @Type(() => PickupPointDto)
  pickupPoint!: PickupPointDto;
}

export class SetChinaTrackDto {
  @IsUUID()
  itemId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  chinaTrackNumber!: string;
}

export class SetFulfillmentModeDto {
  @IsBoolean()
  manual!: boolean;
}

export class RaketaQuickOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  link!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  dwSpuId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  productTitle!: string;

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

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  size!: string;

  @IsNumber()
  @Min(1)
  priceYuan!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  chinaTrackNumber!: string;

  /** Prefix of the RAKETA order title, e.g. a name ("Сергей"). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RaketaQuickDeliveryDto)
  delivery?: RaketaQuickDeliveryDto;
}
