import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class StartBotLoginDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  origin?: string;
}

export class ConfirmBotLoginDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,64}$/)
  token!: string;

  @IsString()
  @Matches(/^\d{1,20}$/)
  telegramId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  languageCode?: string;
}
