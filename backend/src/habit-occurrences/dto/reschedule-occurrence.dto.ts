import { IsString } from 'class-validator';

export class RescheduleOccurrenceDto {
  @IsString()
  readonly date!: string;
}
