import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.dto';
export const Public = () => SetMetadata('auth:public', true);
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<AuthRequest>().authUser!,
);
export interface AuthRequest extends Request {
  authUser?: AuthUser;
}
export const sessionCookie = (): string =>
  process.env.NODE_ENV === 'production'
    ? '__Host-habit_session'
    : 'habit_session';
export function readSession(req: Request): string | undefined {
  return req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookie()}=`))
    ?.slice(sessionCookie().length + 1);
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    context
      .switchToHttp()
      .getResponse<{ setHeader: (name: string, value: string) => void }>()
      .setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // Required on login too. Cookie flags + exact Origin + JSON stop login CSRF and cross-site writes.
      if (
        req.headers.origin !== process.env.FRONTEND_URL ||
        req.headers['content-type']?.split(';')[0].trim().toLowerCase() !==
          'application/json'
      )
        throw new ForbiddenException(
          'Ungültiger Request-Ursprung oder Content-Type.',
        );
    }
    if (
      this.reflector.getAllAndOverride<boolean>('auth:public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const user = await this.auth.authenticate(readSession(req));
    if (!user) throw new UnauthorizedException('Bitte anmelden.');
    req.authUser = user;
    return true;
  }
}
