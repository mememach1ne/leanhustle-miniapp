import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/** Raw payload posted by the Telegram Login Widget (browser login). */
export class TelegramLoginWidgetDto {
  @Type(() => Number)
  @IsInt()
  id!: number;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @Type(() => Number)
  @IsInt()
  auth_date!: number;

  @IsString()
  @IsNotEmpty()
  hash!: string;
}
