import { PaymentNetwork } from '@lean-poizon/shared';
import { IsEnum, IsIn } from 'class-validator';

export class CreateCryptoPaymentIntentDto {
  @IsEnum(PaymentNetwork)
  network!: PaymentNetwork;
}

export class CreateWalletInvoiceDto {
  @IsIn(['CRYPTOBOT', 'XROCKET'])
  provider!: 'CRYPTOBOT' | 'XROCKET';
}
