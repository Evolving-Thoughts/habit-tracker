import { IsString, Matches } from 'class-validator';

export class ApplyReplanDto {
  @IsString()
  @Matches(/^\d{1,16}\.[a-f0-9]{64}$/)
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
