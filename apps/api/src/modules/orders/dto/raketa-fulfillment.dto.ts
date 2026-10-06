import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SetChinaTrackDto {
  @IsUUID()
  itemId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  chinaTrackNumber!: string;
}

export class SetFulfillmentModeDto {
  @IsBoolean()
  manual!: boolean;
}

export class RaketaQuickOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  link!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  dwSpuId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  productTitle!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryL1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryL2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryL3?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  size!: string;

  @IsNumber()
  @Min(1)
  priceYuan!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  chinaTrackNumber!: string;

  /** Prefix of the RAKETA order title, e.g. a name ("Сергей"). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;
}
