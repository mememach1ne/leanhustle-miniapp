import { IsNumber, Max, Min } from 'class-validator';

export class SetActualDeliveryDto {
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  actualDeliveryRub!: number;
}

export class SetActualDutyDto {
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  actualDutyRub!: number;
}
