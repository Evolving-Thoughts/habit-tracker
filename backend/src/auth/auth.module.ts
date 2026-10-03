import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuthTokenEntity,
  RateLimitEntity,
  SessionEntity,
  UserEntity,
} from './auth.entities';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthMailer } from './auth.mailer';
import { AuthService } from './auth.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      SessionEntity,
      AuthTokenEntity,
      RateLimitEntity,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthMailer,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
