import { IsBoolean } from 'class-validator';

/** PUT /day-planner/events/:id/done: a Google event ticked off or opened again. */
export class EventDoneDto {
  @IsBoolean()
  readonly done!: boolean;
}
