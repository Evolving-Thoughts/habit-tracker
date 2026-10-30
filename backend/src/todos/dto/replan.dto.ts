import { IsString, Length, Matches } from 'class-validator';

export class ApplyReplanDto {
  @IsString()
  @Length(64, 64)
  readonly confirmationToken!: string;
}

export class PlanningSettingsDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  readonly dayEnd!: string;
}

export type ReplanChangeResponse = {
  todoId: number;
  title: string;
  from: string;
  pieces: { start: string; minutes: number }[];
  tomorrow: { start: string; minutes: number } | null;
};

export type ReplanPreviewResponse = {
  confirmationToken: string;
  dayEnd: string;
  changes: ReplanChangeResponse[];
};
