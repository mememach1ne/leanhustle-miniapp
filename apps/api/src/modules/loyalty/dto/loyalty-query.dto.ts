import { IsOptional, IsString } from 'class-validator';

export class LoyaltyQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;
}
