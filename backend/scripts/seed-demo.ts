/**
 * Legt lokal ein Demo-Konto mit drei Wochen Nutzung an, zum Durchklicken.
 *
 *   npm run seed:demo        (im Ordner backend, Postgres muss laufen)
 *
 * Anmeldung danach: demo@habit-tracker.test / demo-passwort-lokal
 *
 * Das Skript startet die App im selben Prozess, stellt deren Uhr Tag für Tag
 * zurück und spielt die Nutzung über die echte HTTP-Schnittstelle nach. So
 * entstehen Verlauf, Wochenquoten und Ziele genau wie im Betrieb. Ein schon
 * vorhandenes Demo-Konto wird vorher samt Daten gelöscht.
 *
 * Zwei Dinge holt das Skript selbst nach, weil die verstellte Uhr sie nicht
 * erreicht: Das Anlegedatum der Quests setzt die Datenbank, es wird auf den
 * ersten Tag zurückgesetzt; und den Fortschritt der Kampagnen hält im Betrieb
 * ein stündlicher Job je Tag fest (goal_snapshots), hier am Ende jedes Tags.
 */
import { NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { Clock } from '../src/common/clock';
import { SessionEntity, UserEntity } from '../src/auth/auth.entities';
import { hashPassword, tokenHash } from '../src/auth/auth.crypto';
import { GoalSnapshotsService } from '../src/todos/goal-snapshots.service';

const EMAIL = 'demo@habit-tracker.test';
const PASSWORD = 'demo-passwort-lokal';
const DAYS_BACK = 21;
const TOKEN = 'd'.repeat(43);

if (process.env.NODE_ENV === 'production')
  throw new Error('Nur für die lokale Entwicklung.');

/** Deterministischer Zufall, damit jeder Lauf dieselben Daten ergibt. */
let seed = 42;
const chance = (p: number) => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31 < p;
};

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
};
const at = (date: string, time: string) =>
  new Date(`${date}T${time}:00${berlinOffset(date)}`);
function berlinOffset(date: string): string {
  const name = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Berlin',
    timeZoneName: 'longOffset',
  })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((p) => p.type === 'timeZoneName')!.value;
  return name === 'GMT' ? '+00:00' : name.slice(3);
}

/** Löscht Zeilen samt allem, was per Fremdschlüssel darauf zeigt. */
async function deleteRows(
  db: DataSource,
  table: string,
  column: string,
  values: unknown[],
): Promise<void> {
  if (!values.length) return;
  const refs: { child: string; fk: string; pk: string }[] = await db.query(
    `select c.conrelid::regclass::text as child, a.attname as fk,
            pa.attname as pk
       from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
      where c.contype = 'f' and c.confrelid = $1::regclass`,
    [`"${table}"`],
  );
  for (const ref of refs) {
    const parentKeys: Record<string, unknown>[] = await db.query(
      `select "${ref.pk}" as k from "${table}" where "${column}" = any($1)`,
      [values],
    );
    const child = ref.child.replace(/"/g, '');
    if (child === table) continue;
    await deleteRows(
      db,
      child,
      ref.fk,
      parentKeys.map((r) => r.k),
    );
  }
  await db.query(`delete from "${table}" where "${column}" = any($1)`, [
    values,
  ]);
}

async function main() {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* Variablen kommen von außen */
  }
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const port = (app.getHttpServer().address() as AddressInfo).port;
  const db = app.get(DataSource);
  const clock = app.get(Clock);
  const realNow = clock.now.bind(clock);
  let fakeNow: Date | null = null;
  clock.now = () => fakeNow ?? realNow();

  const host = String(db.options['host' as keyof typeof db.options] ?? '');
  if (host && !['localhost', '127.0.0.1', '::1'].includes(host))
    throw new Error(`Datenbank ${host} ist nicht lokal, Abbruch.`);

  // Altes Demo-Konto samt Daten entfernen, dann neu anlegen.
  const old = await db.getRepository(UserEntity).findOneBy({ email: EMAIL });
  if (old) await deleteRows(db, 'users', 'id', [old.id]);
  const user = await db.getRepository(UserEntity).save({
    email: EMAIL,
    passwordHash: await hashPassword(PASSWORD),
    verifiedAt: new Date(),
  });
  await db.getRepository(SessionEntity).save({
    hash: tokenHash(TOKEN),
    userId: user.id,
    expiresAt: new Date(Date.now() + 3600_000),
  });

  const api = async <T = any>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
        Cookie: `habit_session=${TOKEN}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok)
      throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    return (res.status === 204 ? undefined : res.json()) as Promise<T>;
  };

  const start = day(-DAYS_BACK);
  fakeNow = at(start, '08:00');

  // Kategorien
  const cat: Record<string, number> = {};
  for (const name of ['Gesundheit', 'Lernen', 'Haushalt', 'Arbeit', 'Kreativ'])
    cat[name] = (await api('POST', '/categories', { name })).id;
  await api('PATCH', `/categories/${cat.Gesundheit}`, { weeklyTarget: 10 });
  await api('PATCH', `/categories/${cat.Lernen}`, { weeklyTarget: 5 });

  // Habits
  const habit = async (
    title: string,
    category: string,
    schedule: object,
    extra: object = {},
  ) =>
    (
      await api('POST', '/habits', {
        title,
        categoryId: cat[category],
        startDate: start,
        schedule,
        ...extra,
      })
    ).id as number;
  const H = {
    meditation: await habit(
      'Meditieren',
      'Gesundheit',
      { type: 'interval', intervalDays: 1 },
      {
        timeOfDay: '07:00',
        plannedDurationMinutes: 10,
        why: 'Ruhiger in den Tag starten',
      },
    ),
    laufen: await habit(
      'Laufen gehen',
      'Gesundheit',
      { type: 'fixed_weekdays', weekdays: ['monday', 'wednesday', 'friday'] },
      { timeOfDay: '18:00', plannedDurationMinutes: 40, why: 'Fit bleiben' },
    ),
    lesen: await habit(
      'Lesen',
      'Lernen',
      { type: 'weekly_target', weeklyTarget: 4 },
      { plannedDurationMinutes: 30, why: 'Jeden Monat ein Buch' },
    ),
    vokabeln: await habit(
      'Spanisch-Vokabeln',
      'Lernen',
      { type: 'interval', intervalDays: 1, missedOccurrencePolicy: 'skip' },
      { plannedDurationMinutes: 15 },
    ),
    pflanzen: await habit('Pflanzen gießen', 'Haushalt', {
      type: 'interval',
      intervalDays: 3,
    }),
    gitarre: await habit(
      'Gitarre üben',
      'Kreativ',
      { type: 'fixed_weekdays', weekdays: ['tuesday', 'thursday', 'saturday'] },
      { timeOfDay: '20:00', plannedDurationMinutes: 25 },
    ),
  };
  const habitRate: Record<number, number> = {
    [H.meditation]: 0.85,
    [H.laufen]: 0.75,
    [H.lesen]: 0.7,
    [H.vokabeln]: 0.6,
    [H.pflanzen]: 0.95,
    [H.gitarre]: 0.55,
  };

  // Aufgabenbaum mit Kampagnen
  const todo = async (body: object) =>
    (await api('POST', '/todos', body)).id as number;
  const umzug = await todo({
    title: 'Umzug vorbereiten',
    categoryId: cat.Haushalt,
    why: 'Ende des Monats ist Schlüsselübergabe',
    color: 'ochre',
    icon: 'home',
  });
  const portfolio = await todo({
    title: 'Portfolio-Website',
    categoryId: cat.Arbeit,
    why: 'Für die Bewerbungen im Frühjahr',
    color: 'indigo',
    icon: 'code',
    weeklyTargetMinutes: 180,
  });
  const marathon = await todo({
    title: 'Halbmarathon schaffen',
    categoryId: cat.Gesundheit,
    color: 'moss',
    icon: 'dumbbell',
    why: 'Stadtlauf im April',
  });
  await api('PATCH', `/todos/${marathon}`, {
    goalHabitId: H.laufen,
    goalTarget: 24,
    periodStart: start,
    periodEnd: day(56),
  });

  // Teilaufgaben, verteilt über die vergangenen und kommenden Tage
  const planned: { id: number; date: number; done: boolean; minutes?: number }[] =
    [];
  const sub = async (
    parentId: number,
    title: string,
    offset: number | null,
    extra: object = {},
  ) => {
    const id = await todo({
      title,
      parentId,
      categoryId: undefined,
      scheduledDate: offset === null ? null : day(offset),
      ...extra,
    });
    if (offset !== null) planned.push({ id, date: offset, done: offset < 0 });
    return id;
  };
  await sub(umzug, 'Umzugskartons besorgen', -15);
  await sub(umzug, 'Nachsendeauftrag stellen', -9);
  const kueche = await sub(umzug, 'Küche ausmisten', -4, {
    plannedDurationMinutes: 60,
  });
  await sub(kueche, 'Vorratsschrank leeren', -4);
  await sub(kueche, 'Geschirr spenden', 2);
  await sub(umzug, 'Transporter reservieren', 0, { timeOfDay: '10:00' });
  await sub(umzug, 'Internet ummelden', 3);
  await sub(umzug, 'Wohnungsübergabe-Protokoll', null);
  await sub(portfolio, 'Design-Entwurf', -12, { plannedDurationMinutes: 90 });
  await sub(portfolio, 'Projekte auswählen', -7);
  await sub(portfolio, 'Startseite bauen', -2, { plannedDurationMinutes: 120 });
  await sub(portfolio, 'Texte schreiben', 0, { plannedDurationMinutes: 45 });
  await sub(portfolio, 'Domain kaufen', 4);
  await sub(marathon, 'Laufschuhe testen lassen', -10);
  await sub(marathon, 'Trainingsplan erstellen', -18);

  // Lose Todos (Dump und einzelne Termine)
  for (const title of [
    'Steuererklärung anfangen',
    'Fahrrad reparieren lassen',
    'Geschenk für Lena',
    'Zahnarzttermin ausmachen',
    'Podcast-Empfehlung anhören',
  ])
    await todo({
      title,
      categoryId: title.startsWith('Zahn') ? cat.Gesundheit : undefined,
    });
  planned.push({
    id: await todo({
      title: 'Wocheneinkauf',
      categoryId: cat.Haushalt,
      scheduledDate: day(-6),
    }),
    date: -6,
    done: true,
  });
  planned.push({
    id: await todo({
      title: 'Rechnung Strom überweisen',
      scheduledDate: day(-3),
      categoryId: cat.Haushalt,
    }),
    date: -3,
    done: false, // bleibt überfällig
  });
  planned.push({
    id: await todo({
      title: 'Teammeeting',
      categoryId: cat.Arbeit,
      scheduledDate: day(0),
      timeOfDay: '14:30',
      plannedDurationMinutes: 60,
    }),
    date: 0,
    done: false,
  });
  planned.push({
    id: await todo({
      title: 'Mama anrufen',
      scheduledDate: day(1),
    }),
    date: 1,
    done: false,
  });

  // Die Datenbank stempelt createdAt mit der echten Zeit; im Betrieb
  // entstünden diese Quests am ersten Tag, und der Wochenrückblick rechnet
  // frühere Stände daraus zurück.
  await db.query(
    'update todos set "createdAt" = $1 where "userId" = $2',
    [at(start, '08:00'), user.id],
  );
  const snapshots = app.get(GoalSnapshotsService);

  const reflections = [
    'Guter Tag, Laufen fiel leicht.',
    'Wenig geschafft, war müde. Morgen früher ins Bett.',
    'Portfolio kommt voran, die Startseite gefällt mir.',
    'Meditation hilft wirklich gegen den Stress.',
    'Zu viel auf einmal geplant – weniger ist mehr.',
    'Schöner Abend mit Gitarre.',
  ];

  // Tag für Tag nachspielen
  for (let offset = -DAYS_BACK; offset <= 0; offset++) {
    const date = day(offset);
    const isToday = offset === 0;
    fakeNow = isToday ? null : at(date, '21:00');
    const plan = await api('GET', '/day-planner/today');
    for (const item of plan.items ?? []) {
      if (item.type === 'habit' && item.status === 'pending') {
        if (isToday) {
          if (item.habitId === H.meditation)
            await api('PATCH', `/habit-occurrences/${item.occurrenceId}/status`, {
              status: 'completed',
            });
          continue;
        }
        const done = chance(habitRate[item.habitId] ?? 0.7);
        if (done && item.plannedDurationMinutes && chance(0.5)) {
          const begin = at(date, item.timeOfDay ?? '17:00');
          await api('POST', '/work-logs', {
            kind: 'occurrence',
            targetId: item.occurrenceId,
            startedAt: begin.toISOString(),
            endedAt: new Date(
              begin.getTime() + item.plannedDurationMinutes * 60_000,
            ).toISOString(),
          });
        }
        if (done || chance(0.3))
          await api('PATCH', `/habit-occurrences/${item.occurrenceId}/status`, {
            status: done ? 'completed' : 'skipped',
          });
      }
    }
    for (const p of planned.filter((p) => p.date === offset && p.done)) {
      await api('POST', '/work-logs', {
        kind: 'todo',
        targetId: p.id,
        startedAt: at(date, '15:00').toISOString(),
        endedAt: at(date, '16:10').toISOString(),
      });
      await api('PATCH', `/todos/${p.id}`, { completed: true });
    }
    // Was der stündliche Job an diesem Tag festgehalten hätte.
    await snapshots.record(user.id);
    if (!isToday && chance(0.55))
      await api('PUT', `/reflections/${date}`, {
        text: reflections[Math.abs(offset) % reflections.length],
      });
  }

  await db.getRepository(SessionEntity).delete({ hash: tokenHash(TOKEN) });
  await app.close();
  console.log(
    `Demo-Konto angelegt: ${EMAIL} (${DAYS_BACK} Tage Verlauf, Passwort siehe Skript)`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
