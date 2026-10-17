import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Photo report of one cart item (RAKETA takes the photos at the China warehouse). */
export class CheckoutPhotoReportDto {
  @IsUUID()
  cartItemId!: string;

  @IsIn(['basic', 'individual'])
  kind!: 'basic' | 'individual';

  /** What to photograph (individual report only). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;
}

export class CheckoutDto {
  @IsUUID()
  @IsNotEmpty()
  deliveryAddressId!: string;

  /** RAKETA "Защита от рисков" — 1% of the goods value, paid with delivery. */
  @IsOptional()
  @IsBoolean()
  insurance?: boolean;

  /** Delivery option key from GET /cart/delivery-estimate ("cdek:pvz:EXPR"). */
  @IsOptional()
  @Matches(/^[a-z]+:[a-z]+:[A-Z]+$/)
  deliveryOption?: string;

  /** Extra packaging of every China parcel. */
  @IsOptional()
  @IsIn(['box', 'crate'])
  packaging?: 'box' | 'crate' | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CheckoutPhotoReportDto)
  photoReports?: CheckoutPhotoReportDto[];
}
