import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';

/** PUT /todos/backlog/order: quests of the Questlog, first to last. */
export class ReorderBacklogDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  @Min(1, { each: true })
  readonly ids!: number[];
}
