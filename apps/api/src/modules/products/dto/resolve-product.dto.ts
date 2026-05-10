import { IsNotEmpty, IsString } from 'class-validator';

export class ResolveProductDto {
  @IsString()
  @IsNotEmpty()
  link!: string;
}
