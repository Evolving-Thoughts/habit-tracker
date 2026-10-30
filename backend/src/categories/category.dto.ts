import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CategoryInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  readonly name!: string;
}

export type CategoryResponse = { id: number; name: string };
