import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CheckoutDto {
  @IsUUID()
  @IsNotEmpty()
  deliveryAddressId!: string;

  /** RAKETA "Защита от рисков" — 1% of the goods value, paid with delivery. */
  @IsOptional()
  @IsBoolean()
  insurance?: boolean;
}
