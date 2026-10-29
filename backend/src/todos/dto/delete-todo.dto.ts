import { IsString, Matches } from 'class-validator';
export class DeleteTodoDto {
  /** From GET /todos/:id/deletion-preview; required for every delete. */
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  readonly confirmationToken!: string;
}
