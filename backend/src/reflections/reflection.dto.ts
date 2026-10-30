import { IsString, MaxLength } from 'class-validator';

export class SaveReflectionDto {
  @IsString()
  @MaxLength(10000)
  readonly text!: string;
}

export type ReflectionResponse = { date: string; text: string };
