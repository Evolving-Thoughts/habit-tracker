import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { AuthRequest } from '../auth/auth.guard';
import { LiveService } from './live.service';

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** At most this much of a client's id is passed on; it is only an echo. */
const ORIGIN_LENGTH = 64;

/**
 * Every write that succeeded tells the person's other open apps, whatever
 * it changed: a quest, a daily, the stopwatch, a setting. A failed write
 * changed nothing and says nothing.
 */
@Injectable()
export class LiveInterceptor implements NestInterceptor {
  constructor(private readonly live: LiveService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (READS.has(req.method)) return next.handle();
    return next.handle().pipe(
      tap(() => {
        const userId = req.authUser?.id;
        if (!userId) return;
        const origin = req.headers['x-client-id'];
        this.live.notify(
          userId,
          typeof origin === 'string' ? origin.slice(0, ORIGIN_LENGTH) : null,
        );
      }),
    );
  }
}
