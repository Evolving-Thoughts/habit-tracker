import { IsOptional, IsString, Matches } from 'class-validator';
export class DeleteTodoDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  readonly confirmationToken?: string;
}
