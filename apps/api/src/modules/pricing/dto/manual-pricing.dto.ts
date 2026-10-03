import { DeliveryCategory } from '@lean-poizon/shared';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ManualPricingDto {
  @IsNumber()
  @Min(1)
  priceYuan!: number;

  @IsEnum(DeliveryCategory)
  deliveryCategory!: DeliveryCategory;

  /** Optional size (e.g. "42", "M") — picks the delivery price band. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  size?: string;
}
