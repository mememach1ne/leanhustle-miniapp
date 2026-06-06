import { PaymentNetwork } from '@lean-poizon/shared';
import { IsEnum } from 'class-validator';

export class CreateCryptoPaymentIntentDto {
  @IsEnum(PaymentNetwork)
  network!: PaymentNetwork;
}
