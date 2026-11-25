import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '../auth/auth.dto';
import { CurrentUser } from '../auth/auth.guard';
import { LiveService } from './live.service';

/**
 * Well below the 60 s nginx waits by default and the 15 s of the local
 * tunnel (`scripts/tunnel-server.mjs`), so a quiet line stays open.
 */
export const HEARTBEAT_MS = 10_000;

/**
 * `GET /live`: a Server-Sent Events stream of "changed" for the signed-in
 * person, behind the session like every other route. The browser
 * reconnects by itself (`retry`); a heartbeat comment keeps proxies from
 * closing a quiet line.
 */
@Controller('live')
export class LiveController {
  constructor(private readonly live: LiveService) {}

  @Get()
  stream(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');
    // nginx must pass each event on at once instead of collecting them.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('retry: 5000\n\n');

    const unsubscribe = this.live.subscribe(user.id, (origin) => {
      res.write(`event: changed\ndata: ${JSON.stringify({ origin })}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    heartbeat.unref();
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }
}
