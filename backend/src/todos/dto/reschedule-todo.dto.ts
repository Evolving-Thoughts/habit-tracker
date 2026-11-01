import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RescheduleTodoDto {
  @IsString()
  readonly date!: string;

  /** Required to move a fixed todo: it never moves without being asked. */
  @IsOptional()
  @IsBoolean()
  readonly confirmFixed?: boolean;
}
