import type { AuthRequest } from './auth.guard';
import type { AuthUser } from './auth.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AuthService,
  GENERIC_MAIL_MESSAGE,
  SESSION_DAYS,
} from './auth.service';
import { CurrentUser, Public, readSession, sessionCookie } from './auth.guard';
import {
  CredentialsDto,
  EmailDto,
  ResetPasswordDto,
  TokenDto,
} from './auth.dto';
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get('me') me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
  @Public()
  @Post('register')
  @HttpCode(202)
  async register(
    @Body() dto: CredentialsDto,
    @Req() req: AuthRequest,
  ): Promise<{ message: string }> {
    await this.auth.limit('register', req.ip ?? 'unknown', dto.email);
    await this.auth.register(dto);
    return { message: GENERIC_MAIL_MESSAGE };
  }
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: CredentialsDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    await this.auth.limit('login', req.ip ?? 'unknown', dto.email);
    const result = await this.auth.login(dto);
    res.cookie(sessionCookie(), result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_DAYS * 86400_000,
    });
    return result.user;
  }
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(readSession(req));
    res.clearCookie(sessionCookie(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }
  @Public()
  @Post('verify-email')
  @HttpCode(204)
  async verify(@Body() dto: TokenDto, @Req() req: AuthRequest): Promise<void> {
    await this.auth.limit('verify', req.ip ?? 'unknown');
    await this.auth.verify(dto.token);
  }
  @Public()
  @Post('resend-verification')
  @HttpCode(202)
  async resend(
    @Body() dto: EmailDto,
    @Req() req: AuthRequest,
  ): Promise<{ message: string }> {
    await this.auth.limit('resend', req.ip ?? 'unknown', dto.email);
    await this.auth.requestMail(dto.email, 'verify');
    return { message: GENERIC_MAIL_MESSAGE };
  }
  @Public()
  @Post('forgot-password')
  @HttpCode(202)
  async forgot(
    @Body() dto: EmailDto,
    @Req() req: AuthRequest,
  ): Promise<{ message: string }> {
    await this.auth.limit('forgot', req.ip ?? 'unknown', dto.email);
    await this.auth.requestMail(dto.email, 'reset');
    return { message: GENERIC_MAIL_MESSAGE };
  }
  @Public()
  @Post('reset-password')
  @HttpCode(204)
  async reset(
    @Body() dto: ResetPasswordDto,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.auth.limit('reset', req.ip ?? 'unknown');
    await this.auth.reset(dto.token, dto.password);
  }
}
