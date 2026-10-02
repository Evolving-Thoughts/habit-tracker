import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateHabitDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  readonly isActive?: boolean;
}
