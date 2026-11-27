import { IsBoolean } from 'class-validator';

/** POST /todos/:id/set-aside: puts an open quest back out of "In Arbeit". */
export class SetAsideTodoDto {
  /** Whether it waits on something ("Geblockt"). */
  @IsBoolean()
  readonly blocked!: boolean;
}
