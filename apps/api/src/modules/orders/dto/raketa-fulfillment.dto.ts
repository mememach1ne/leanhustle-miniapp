import { IsBoolean, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

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
