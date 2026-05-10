import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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
}
