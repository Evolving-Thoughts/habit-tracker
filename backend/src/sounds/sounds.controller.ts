import { Controller, Get, HttpException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { SoundsResponse } from './sound.dto';
import { SoundsService } from './sounds.service';

/** Behind the global session guard: the files are for signed-in users only. */
@Controller('sounds')
export class SoundsController {
  constructor(private readonly sounds: SoundsService) {}

  @Get()
  list(): Promise<SoundsResponse> {
    return this.sounds.list();
  }

  /**
   * Streams the file with Range (206) and ETag support from `res.sendFile`.
   * The URL carries the version, so the file may stay cached for good.
   */
  @Get(':id')
  async file(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const file = await this.sounds.file(id);
    await new Promise<void>((resolve, reject) => {
      res.sendFile(
        file,
        {
          root: this.sounds.dir,
          dotfiles: 'deny',
          // Set once the transfer starts; errors keep the guard's no-store.
          headers: {
            'Content-Type': 'audio/ogg',
            'Cache-Control': 'private, max-age=31536000, immutable',
          },
        },
        (error?: Error & { status?: number; code?: string }) => {
          // A client that hangs up mid-file is nothing to answer.
          if (!error || res.headersSent || error.code === 'ECONNABORTED')
            return resolve();
          const status = error.status ?? 500;
          reject(
            new HttpException(
              status === 404
                ? 'Diesen Klang gibt es auf dem Server nicht.'
                : 'Der Klang ließ sich nicht senden.',
              status,
            ),
          );
        },
      );
    });
  }
}
