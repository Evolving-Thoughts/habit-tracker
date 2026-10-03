import { Type } from 'class-transformer';
import {
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
  IsDefined,
} from 'class-validator';
class KeysDto {
  @IsString() @MaxLength(100) p256dh!: string;
  @IsString() @MaxLength(30) auth!: string;
}
export class SubscribeDto {
  @IsString() @MaxLength(2048) endpoint!: string;
  @IsDefined() @ValidateNested() @Type(() => KeysDto) keys!: KeysDto;
}
export class UnsubscribeDto {
  @IsUUID() id!: string;
}
