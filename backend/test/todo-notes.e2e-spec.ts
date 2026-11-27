import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { configureApp } from '../src/configure-app';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { NOTES_MAX_LENGTH } from '../src/todos/todo-notes';
import {
  authenticatedRequest as request,
  seedAuth,
  SEEDED_AUTH_TABLES,
} from './auth-fixture';
import { resetDatabase } from './reset-database';

const OTHER_USER = '22222222-2222-4222-8222-222222222222';

const paragraph = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});
const doc = (...content: object[]) => ({ type: 'doc', content });

describe('Todo notes (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  const todo = async (): Promise<number> =>
    (
      (await request(server).post('/todos').send({ title: 'Buch' }).expect(201))
        .body as { id: number }
    ).id;
  const read = async (id: number): Promise<unknown> =>
    (
      (await request(server).get(`/todos/${id}/notes`).expect(200)).body as {
        notes: unknown;
      }
    ).notes;
  const write = (id: number, notes: unknown) =>
    request(server).put(`/todos/${id}/notes`).send({ notes });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await seedAuth(app);
    server = app.getHttpServer() as Server;
    db = app.get(DataSource);
    await db.getRepository(UserEntity).save({
      id: OTHER_USER,
      email: 'other@example.test',
      passwordHash: 'x',
      verifiedAt: new Date(),
    });
  });
  beforeEach(() => resetDatabase(db, { keep: SEEDED_AUTH_TABLES }));
  afterAll(() => app.close());

  it('starts without notes, stores a document and gives it back', async () => {
    const id = await todo();
    expect(await read(id)).toBeNull();

    const written = doc(
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Plan' }],
      },
      paragraph('Erst gliedern, dann schreiben.'),
    );
    const response = await write(id, written).expect(200);
    expect((response.body as { notes: unknown }).notes).toEqual(written);
    expect(await read(id)).toEqual(written);
  });

  it('keeps notes out of every list of todos', async () => {
    const id = await todo();
    await write(id, doc(paragraph('Nur hier'))).expect(200);
    for (const path of [
      '/todos',
      '/todos/hierarchy',
      '/todos/backlog',
      `/todos/${id}`,
    ]) {
      const response = await request(server).get(path).expect(200);
      expect(JSON.stringify(response.body)).not.toContain('Nur hier');
    }
  });

  it('stores only what the editor can show', async () => {
    const id = await todo();
    await write(
      id,
      doc(
        { type: 'iframe', attrs: { src: 'https://evil.example' } },
        {
          type: 'paragraph',
          attrs: { onclick: 'alert(1)' },
          content: [
            {
              type: 'text',
              text: 'Link',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ),
    ).expect(200);
    expect(await read(id)).toEqual(doc(paragraph('Link')));
  });

  it('clears the notes with null or an empty document', async () => {
    const id = await todo();
    await write(id, doc(paragraph('Etwas'))).expect(200);
    await write(id, doc({ type: 'paragraph' })).expect(200);
    expect(await read(id)).toBeNull();
    await write(id, doc(paragraph('Wieder'))).expect(200);
    await write(id, null).expect(200);
    expect(await read(id)).toBeNull();
  });

  it('rejects what is not a document or is too long', async () => {
    const id = await todo();
    await write(id, 'einfach Text').expect(400);
    await write(id, { type: 'paragraph' }).expect(400);
    await write(id, doc(paragraph('a'.repeat(NOTES_MAX_LENGTH)))).expect(400);
    await request(server)
      .put(`/todos/${id}/notes`)
      .send({ notes: doc(paragraph('x')), title: 'Umbenannt' })
      .expect(400);
    expect(await read(id)).toBeNull();
  });

  it('never reads or writes the notes of another user', async () => {
    const [{ id: foreign }] = await db.query<{ id: number }[]>(
      `INSERT INTO todos ("userId", title, notes) VALUES ($1, 'Fremd', $2)
       RETURNING id`,
      [OTHER_USER, JSON.stringify(doc(paragraph('Geheim')))],
    );
    await request(server).get(`/todos/${foreign}/notes`).expect(404);
    await write(foreign, doc(paragraph('Überschrieben'))).expect(404);
    const stored = await db.getRepository(TodoEntity).findOne({
      select: { id: true, notes: true },
      where: { id: foreign },
    });
    expect(JSON.stringify(stored?.notes)).toContain('Geheim');
  });
});
