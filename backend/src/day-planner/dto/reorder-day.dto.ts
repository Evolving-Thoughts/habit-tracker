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
  @IsIn(['todo', 'habit'])
  readonly type!: 'todo' | 'habit';

  /** A todo's id, or the id of a habit occurrence. */
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
