import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Stats } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { SoundResponse, SoundsResponse } from './sound.dto';
import { SOUND_CATALOG, type SoundEntry } from './sound-catalog';

/** Where the container sees the bind-mounted sounds folder. */
export const DEFAULT_SOUNDS_DIR = '/app/sounds';

/**
 * A short tag for one state of a file: the same while size and modification
 * time stay, new after the file is replaced.
 */
export function soundVersion(size: number, mtimeMs: number): string {
  return createHash('sha256')
    .update(`${size}:${mtimeMs}`)
    .digest('base64url')
    .slice(0, 12);
}

/** The catalog, narrowed to the files that are on the server. */
@Injectable()
export class SoundsService {
  /** Absolute, as `res.sendFile` needs it. */
  readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = resolve(config.get<string>('SOUNDS_DIR') || DEFAULT_SOUNDS_DIR);
  }

  /** Looks at the folder on every call, so an upload shows without a restart. */
  async list(): Promise<SoundsResponse> {
    const found = await Promise.all(
      SOUND_CATALOG.map(async (entry): Promise<SoundResponse | null> => {
        const stats = await this.stat(entry);
        return (
          stats && {
            id: entry.id,
            title: entry.title,
            kind: entry.kind,
            version: soundVersion(stats.size, stats.mtimeMs),
          }
        );
      }),
    );
    return { sounds: found.filter((sound) => sound !== null) };
  }

  /**
   * The file name (inside `dir`) of a catalog sound. Only catalog ids count,
   * so no path from the request ever reaches the file system.
   */
  async file(id: string): Promise<string> {
    const entry = SOUND_CATALOG.find((candidate) => candidate.id === id);
    if (!entry || !(await this.stat(entry)))
      throw new NotFoundException('Diesen Klang gibt es auf dem Server nicht.');
    return entry.file;
  }

  private async stat(entry: SoundEntry): Promise<Stats | null> {
    try {
      const stats = await stat(join(this.dir, entry.file));
      return stats.isFile() ? stats : null;
    } catch {
      return null;
    }
  }
}
