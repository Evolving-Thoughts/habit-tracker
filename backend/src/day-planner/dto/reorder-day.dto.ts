import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderedItemDto {
  @IsIn(['todo', 'habit', 'event'])
  readonly type!: 'todo' | 'habit' | 'event';

  /**
   * A todo's id, the id of a habit occurrence, or a Google event's
   * (`externalEvents[].id`), which holds its place but never moves in time.
   */
  @IsInt()
  @Min(1)
  readonly id!: number;
}

/** PUT /day-planner/order: the sortable items of one day, first to last. */
export class ReorderDayDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => OrderedItemDto)
  readonly items!: OrderedItemDto[];
}
