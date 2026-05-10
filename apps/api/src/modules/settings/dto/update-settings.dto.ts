import { IsNumber, IsOptional, Max, Min } from 'class-validator';

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
}
