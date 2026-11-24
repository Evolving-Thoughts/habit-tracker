import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { join } from 'node:path';
import anonymous from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import type { SoundsResponse } from '../src/sounds/sound.dto';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

// SOUNDS_DIR points here (set-e2e-env.ts): rain.ogg and chime-done.ogg only.
const RAIN = readFileSync(join(__dirname, 'fixtures', 'sounds', 'rain.ogg'));

describe('Fokus-Klänge (e2e)', () => {
  let app: INestApplication, server: Server;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await seedAuth(app);
    server = app.getHttpServer() as Server;
  });
  afterAll(() => app.close());

  it('serves list and files to signed-in users only', async () => {
    await anonymous(server).get('/sounds').expect(401);
    await anonymous(server).get('/sounds/rain').expect(401);
  });

  it('lists only the catalog sounds whose file is on the server', async () => {
    const body = (await request(server).get('/sounds').expect(200))
      .body as SoundsResponse;
    const { sounds } = body;
    expect(sounds.map(({ id, title, kind }) => ({ id, title, kind }))).toEqual([
      { id: 'rain', title: 'Regen', kind: 'ambience' },
      { id: 'chime-done', title: 'Erledigt', kind: 'chime' },
    ]);
    expect(sounds.every(({ version }) => /^[\w-]{12}$/.test(version))).toBe(
      true,
    );
    // Unchanged files keep their version.
    expect((await request(server).get('/sounds').expect(200)).body).toEqual(
      body,
    );
  });

  it('answers 404 for ids outside the catalog or without a file', async () => {
    await request(server).get('/sounds/thunder').expect(404);
    await request(server).get('/sounds/cafe').expect(404);
    await request(server).get('/sounds/rain.ogg').expect(404);
    await request(server).get('/sounds/..%2Fpackage.json').expect(404);
  });

  it('sends the whole file, cacheable for good', async () => {
    const response = await request(server)
      .get('/sounds/rain?v=abc')
      .responseType('blob')
      .expect(200)
      .expect('Content-Type', 'audio/ogg')
      .expect('Accept-Ranges', 'bytes')
      .expect('Cache-Control', 'private, max-age=31536000, immutable');
    expect(response.body).toEqual(RAIN);
    expect(response.headers.etag).toBeTruthy();

    await request(server)
      .get('/sounds/rain')
      .set('If-None-Match', response.headers.etag)
      .expect(304);
  });

  it('sends a byte range as 206', async () => {
    const response = await request(server)
      .get('/sounds/rain')
      .set('Range', 'bytes=0-9')
      .responseType('blob')
      .expect(206)
      .expect('Content-Type', 'audio/ogg')
      .expect('Content-Range', `bytes 0-9/${RAIN.length}`);
    expect(response.body).toEqual(RAIN.subarray(0, 10));
  });
});
