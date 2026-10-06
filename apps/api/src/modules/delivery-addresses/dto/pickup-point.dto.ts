import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** CDEK pickup point chosen from the RAKETA directory. */
export class PickupPointDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  cityId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  region?: string | null;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,32}$/)
  pvzCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  pvzIndex?: string | null;
}
