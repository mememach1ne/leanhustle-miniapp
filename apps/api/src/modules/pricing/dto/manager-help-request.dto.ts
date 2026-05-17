import { DeliveryCategory } from '@lean-poizon/shared';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ManagerHelpRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  dewuLink!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  size?: string;

  @IsEnum(DeliveryCategory)
  deliveryCategory!: DeliveryCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
