import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateDeliveryAddressDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  cdekAddress?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Телефон должен быть в формате +7XXXXXXXXXX' })
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
