import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  request as httpRequest,
  type IncomingMessage,
  type Server,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { LiveService } from '../src/live/live.service';
import {
  authenticatedRequest as request,
  seedAuth,
  TEST_SESSION_TOKEN,
  TEST_USER,
} from './auth-fixture';

/** Opens `GET /live` with the test session and collects what it sends. */
function listen(
  server: Server,
  cookie: string | null,
): Promise<{
  response: IncomingMessage;
  text: () => string;
  close: () => void;
}> {
  const { port } = server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    let text = '';
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path: '/live',
        headers: cookie ? { Cookie: cookie } : {},
      },
      (response) => {
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (text += chunk));
        resolve({ response, text: () => text, close: () => req.destroy() });
      },
    );
    req.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(error);
    });
    req.end();
  });
}

const until = async (check: () => boolean): Promise<void> => {
  for (let i = 0; i < 50 && !check(); i++)
    await new Promise((resolve) => setTimeout(resolve, 20));
};

describe('Live updates (e2e)', () => {
  let app: INestApplication, server: Server;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await app.listen(0, '127.0.0.1');
    await seedAuth(app);
    server = app.getHttpServer() as Server;
  });
  afterAll(() => app.close());

  it('needs the session', async () => {
    const { response, close } = await listen(server, null);
    expect(response.statusCode).toBe(401);
    close();
  });

  it('tells an open app about a write, naming the app that made it', async () => {
    const live = app.get(LiveService);
    const stream = await listen(server, `habit_session=${TEST_SESSION_TOKEN}`);
    expect(stream.response.statusCode).toBe(200);
    expect(stream.response.headers['content-type']).toContain(
      'text/event-stream',
    );
    expect(stream.response.headers['x-accel-buffering']).toBe('no');
    await until(() => live.listening(TEST_USER) === 1);

    // A read says nothing.
    await request(server).get('/todos').expect(200);
    await request(server)
      .post('/todos')
      .set('X-Client-Id', 'phone-1')
      .send({ title: 'Neu am PC' })
      .expect(201);
    await until(() => stream.text().includes('event: changed'));
    expect(stream.text()).toContain('retry: 5000');
    expect(stream.text().match(/event: changed/g)).toHaveLength(1);
    expect(stream.text()).toContain('data: {"origin":"phone-1"}');
    // Nothing of the change itself goes out.
    expect(stream.text()).not.toContain('Neu am PC');

    // A failed write changed nothing and says nothing.
    await request(server).post('/todos').send({}).expect(400);

    stream.close();
    await until(() => live.listening(TEST_USER) === 0);
    expect(live.listening(TEST_USER)).toBe(0);
    expect(stream.text().match(/event: changed/g)).toHaveLength(1);
  });
});
