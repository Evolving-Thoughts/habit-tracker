import { IsDateString, IsIn, IsInt, Min } from 'class-validator';
import { WorkLogSource } from './work-log.entity';

export class WorkLogTimesDto {
  @IsDateString()
  readonly startedAt!: string;

  @IsDateString()
  readonly endedAt!: string;
}

export class CreateWorkLogDto extends WorkLogTimesDto {
  @IsIn(['todo', 'occurrence'])
  readonly kind!: 'todo' | 'occurrence';

  @IsInt()
  @Min(1)
  readonly targetId!: number;
}

export type WorkLogResponse = {
  id: number;
  title: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  source: WorkLogSource;
};

export type WorkDayResponse = {
  date: string;
  /** Overlapping entries count once. */
  totalMinutes: number;
  logs: WorkLogResponse[];
};
