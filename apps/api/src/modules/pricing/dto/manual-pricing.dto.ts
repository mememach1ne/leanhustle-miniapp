import { DeliveryCategory } from '@lean-poizon/shared';
import { IsEnum, IsNumber, Min } from 'class-validator';

export class ManualPricingDto {
  @IsNumber()
  @Min(1)
  priceYuan!: number;

  @IsEnum(DeliveryCategory)
  deliveryCategory!: DeliveryCategory;
}
