import { IsInt, Min } from 'class-validator';

export class UpdateCartItemQuantityDto {
  @IsInt()
  @Min(0)
  quantity!: number;
}
