import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';

import { PickupPointDto } from '../../delivery-addresses/dto/pickup-point.dto';

export class SetOrderPickupPointDto {
  @ValidateNested()
  @Type(() => PickupPointDto)
  pickupPoint!: PickupPointDto;

  /** Human-readable point address, e.g. "Коломна, бульвар 800-летия Коломны, 14 (KLM5)". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  label!: string;
}
