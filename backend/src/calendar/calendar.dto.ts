import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class CalendarSettingDto {
  @IsString()
  @MaxLength(300)
  readonly calendarId!: string;

  @IsBoolean()
  readonly blocksPlanning!: boolean;
}
