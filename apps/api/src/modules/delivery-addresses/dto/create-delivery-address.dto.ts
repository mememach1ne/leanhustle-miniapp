import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

import { PickupPointDto } from './pickup-point.dto';

export class CreateDeliveryAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  cdekAddress!: string;

  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Телефон должен быть в формате +7XXXXXXXXXX' })
  phone!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PickupPointDto)
  pickupPoint?: PickupPointDto;
}
