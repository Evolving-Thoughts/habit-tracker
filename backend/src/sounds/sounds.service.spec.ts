import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_SOUNDS_DIR,
  SoundsService,
  soundVersion,
} from './sounds.service';

const configWith = (dir: string | undefined) =>
  ({ get: () => dir }) as unknown as ConfigService;

describe('SoundsService', () => {
  let dir: string;
  let service: SoundsService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sounds-'));
    service = new SoundsService(configWith(dir));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('offers only the catalog sounds whose file is there, in catalog order', async () => {
    await writeFile(join(dir, 'chime-done.ogg'), 'x');
    await writeFile(join(dir, 'rain.ogg'), 'xx');
    await writeFile(join(dir, 'not-in-catalog.ogg'), 'x');
    // A folder with a catalog name is no sound.
    await mkdir(join(dir, 'cafe.ogg'));

    const { sounds } = await service.list();

    expect(sounds.map(({ id, title, kind }) => ({ id, title, kind }))).toEqual([
      { id: 'rain', title: 'Regen', kind: 'ambience' },
      { id: 'chime-done', title: 'Erledigt', kind: 'chime' },
    ]);
    expect(sounds[0].version).toMatch(/^[\w-]{12}$/);
  });

  it('keeps the version while the file stays and changes it with the file', async () => {
    const file = join(dir, 'rain.ogg');
    await writeFile(file, 'old');
    const first = (await service.list()).sounds[0].version;
    expect((await service.list()).sounds[0].version).toBe(first);

    await writeFile(file, 'new');
    await utimes(file, new Date('2026-11-01'), new Date('2026-11-01'));
    expect((await service.list()).sounds[0].version).not.toBe(first);

    expect(soundVersion(10, 1000)).toBe(soundVersion(10, 1000));
    expect(soundVersion(10, 1000)).not.toBe(soundVersion(11, 1000));
    expect(soundVersion(10, 1000)).not.toBe(soundVersion(10, 1001));
  });

  it('lists nothing when the folder is missing', async () => {
    const missing = new SoundsService(configWith(join(dir, 'absent')));
    await expect(missing.list()).resolves.toEqual({ sounds: [] });
  });

  it('resolves only catalog ids with a file on disk', async () => {
    await writeFile(join(dir, 'rain.ogg'), 'x');
    await writeFile(join(dir, 'secret.txt'), 'x');

    await expect(service.file('rain')).resolves.toBe('rain.ogg');
    await expect(service.file('cafe')).rejects.toThrow(NotFoundException);
    await expect(service.file('secret.txt')).rejects.toThrow(NotFoundException);
    await expect(service.file('../rain.ogg')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('falls back to the container folder without SOUNDS_DIR', () => {
    expect(new SoundsService(configWith(undefined)).dir).toMatch(
      /[\\/]app[\\/]sounds$/,
    );
    expect(DEFAULT_SOUNDS_DIR).toBe('/app/sounds');
  });
});
