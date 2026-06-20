import { IsISO8601 } from 'class-validator';

export class ProfitReportQueryDto {
  /** Inclusive start day, yyyy-mm-dd. */
  @IsISO8601()
  from!: string;

  /** Inclusive end day, yyyy-mm-dd. */
  @IsISO8601()
  to!: string;
}
