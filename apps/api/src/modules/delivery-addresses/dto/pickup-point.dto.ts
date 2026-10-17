import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Door address for a courier (street + house from the address directory). */
export class CourierAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  fullAddress!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  street!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  house!: string;

  @Matches(/^\d{6}$/, { message: 'Индекс дома не определился — выберите адрес из подсказок.' })
  index!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  apartment?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  entrance?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  floor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  intercom?: string | null;

  @IsOptional()
  @IsBoolean()
  privateHouse?: boolean;
}

/** Pickup point (CDEK / post office / partner) or a courier door, from the RAKETA directory. */
export class PickupPointDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  cityId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  region?: string | null;

  @IsOptional()
  @IsIn(['pvz', 'courier'])
  kind?: 'pvz' | 'courier';

  @IsOptional()
  @IsIn(['cdek', 'pochta', 'raketa'])
  carrier?: 'cdek' | 'pochta' | 'raketa';

  @ValidateIf((o: PickupPointDto) => o.kind !== 'courier')
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,32}$/)
  pvzCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  pvzIndex?: string | null;

  @ValidateIf((o: PickupPointDto) => o.kind === 'courier')
  @ValidateNested()
  @Type(() => CourierAddressDto)
  courier?: CourierAddressDto | null;
}
