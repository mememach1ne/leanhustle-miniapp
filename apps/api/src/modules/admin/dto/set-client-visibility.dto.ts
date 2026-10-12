import { IsBoolean } from 'class-validator';

export class SetClientVisibilityDto {
  @IsBoolean()
  hidden!: boolean;
}
