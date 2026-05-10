import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateOrderTrackCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  trackCode!: string;
}
