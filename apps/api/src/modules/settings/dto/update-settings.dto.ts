import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class LoyaltyTierInputDto {
  @IsString()
  key!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  thresholdUsd!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentPoints!: number;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  cnyToUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  cnyToRub?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  eurToRub?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  deliveryPricePerKgRub?: number;

  @IsOptional()
  @IsBoolean()
  loyaltyEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoyaltyTierInputDto)
  loyaltyTiers?: LoyaltyTierInputDto[];
}
