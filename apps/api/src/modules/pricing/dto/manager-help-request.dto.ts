import { DeliveryCategory } from '@lean-poizon/shared';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ManagerHelpRequestDto {
  @IsString()
  @IsNotEmpty()
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
