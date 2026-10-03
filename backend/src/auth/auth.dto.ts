import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
export class EmailDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
export class CredentialsDto extends EmailDto {
  @IsString() @Length(12, 128) password!: string;
}
export class TokenDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
}
export class ResetPasswordDto extends TokenDto {
  @IsString() @Length(12, 128) password!: string;
}
export interface AuthUser {
  id: string;
  email: string;
}
