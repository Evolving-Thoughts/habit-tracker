import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class OrderedItemDto {
  @IsIn(['todo', 'habit', 'event', 'forecast'])
  readonly type!: 'todo' | 'habit' | 'event' | 'forecast';

  /**
   * A todo's id, the id of a habit occurrence, a Google event's
   * (`externalEvents[].id`), which holds its place but never moves in time,
   * or for a forecast run the habit's id, with its `date`.
   */
  @IsInt()
  @Min(1)
  readonly id!: number;

  /** Only for a forecast run: the day the schedule forecasts it for. */
  @ValidateIf((item: OrderedItemDto) => item.type === 'forecast')
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly date?: string;
}

/** PUT /day-planner/order: the sortable items of one day, first to last. */
export class ReorderDayDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => OrderedItemDto)
  readonly items!: OrderedItemDto[];
}
