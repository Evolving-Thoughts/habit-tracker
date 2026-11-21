import type { EntityManager } from 'typeorm';
import { elapsedAt } from './timer-math';
import { closeWorkSegment, resumeWorkSegment } from './timer-target';
import type { TimerEntity } from './timer.entity';

type Log = { id: number; startedAt: Date; endedAt: Date };

/** Just the two writes `closeWorkSegment` makes, on an in-memory log. */
function fakeManager(): { manager: EntityManager; logs: Log[] } {
  const logs: Log[] = [];
  const manager = {
    insert: (_entity: unknown, values: Omit<Log, 'id'>) => {
      const id = logs.length + 1;
      logs.push({ id, startedAt: values.startedAt, endedAt: values.endedAt });
      return Promise.resolve({ identifiers: [{ id }] });
    },
    update: (
      _entity: unknown,
      criteria: { id: number },
      values: { endedAt: Date },
    ) => {
      const log = logs.find((entry) => entry.id === criteria.id);
      if (log) log.endedAt = values.endedAt;
      return Promise.resolve({ affected: log ? 1 : 0 });
    },
  } as unknown as EntityManager;
  return { manager, logs };
}

const at = (time: string): Date => new Date(`2026-11-20T${time}Z`);

function running(from: string): TimerEntity {
  return {
    userId: 'user',
    todoId: 1,
    occurrenceId: null,
    title: 'Schreiben',
    state: 'running',
    targetMinutes: null,
    elapsedMilliseconds: 0,
    segmentStartedAt: at(from),
    blockStartedAt: null,
    pausedAt: null,
    workLogId: null,
    idleMilliseconds: 0,
  } as TimerEntity;
}

async function pause(
  manager: EntityManager,
  timer: TimerEntity,
  time: string,
): Promise<void> {
  await closeWorkSegment(manager, timer, at(time));
  timer.state = 'paused';
}

const spans = (logs: Log[]) =>
  logs.map(({ startedAt, endedAt }) => [
    startedAt.toISOString().slice(11, 19),
    endedAt.toISOString().slice(11, 19),
  ]);

describe('The time a stopwatch shows', () => {
  it('keeps a stretch under a minute in view while paused', async () => {
    const { manager, logs } = fakeManager();
    const timer = running('10:00:00');
    await pause(manager, timer, '10:00:40');
    expect(logs).toEqual([]);
    expect(elapsedAt(timer, at('10:00:50'))).toBe(40_000);
    // Resumed within the minute, it counts on from there.
    resumeWorkSegment(timer, at('10:00:55'));
    expect(elapsedAt(timer, at('10:00:55'))).toBe(40_000);
    expect(elapsedAt(timer, at('10:01:05'))).toBe(50_000);
  });

  it('never jumps on resume, whatever the pause', async () => {
    const { manager } = fakeManager();
    const timer = running('10:00:00');
    timer.elapsedMilliseconds = 30 * 60_000;
    // A short stretch, a long pause, then on again.
    await pause(manager, timer, '10:00:20');
    expect(elapsedAt(timer, at('10:05:00'))).toBe(30 * 60_000 + 20_000);
    resumeWorkSegment(timer, at('10:05:00'));
    expect(elapsedAt(timer, at('10:05:00'))).toBe(30 * 60_000 + 20_000);
    // A long stretch, a short pause, a long pause.
    await pause(manager, timer, '10:10:00');
    resumeWorkSegment(timer, at('10:10:30'));
    await pause(manager, timer, '10:12:00');
    const shown = 30 * 60_000 + 20_000 + 5 * 60_000 + 90_000;
    expect(elapsedAt(timer, at('10:12:30'))).toBe(shown);
    resumeWorkSegment(timer, at('10:20:00'));
    expect(elapsedAt(timer, at('10:20:00'))).toBe(shown);
    expect(elapsedAt(timer, at('10:21:00'))).toBe(shown + 60_000);
  });
});

describe('Work blocks of a stopwatch', () => {
  it('continues one log when resumed within a minute of the pause', async () => {
    const { manager, logs } = fakeManager();
    const timer = running('10:00:00');
    await pause(manager, timer, '10:05:00');
    resumeWorkSegment(timer, at('10:05:40'));
    // The log counts the pause, the stopwatch does not: it runs on from 5:00.
    expect(elapsedAt(timer, at('10:05:40'))).toBe(5 * 60_000);
    expect(elapsedAt(timer, at('10:06:00'))).toBe(5 * 60_000 + 20_000);
    await pause(manager, timer, '10:08:00');
    expect(spans(logs)).toEqual([['10:00:00', '10:08:00']]);
    expect(elapsedAt(timer, at('10:09:00'))).toBe(7 * 60_000 + 20_000);
  });

  it('starts a second log after a pause of a minute or more', async () => {
    const { manager, logs } = fakeManager();
    const timer = running('10:00:00');
    await pause(manager, timer, '10:05:00');
    resumeWorkSegment(timer, at('10:06:00'));
    await pause(manager, timer, '10:09:00');
    expect(spans(logs)).toEqual([
      ['10:00:00', '10:05:00'],
      ['10:06:00', '10:09:00'],
    ]);
    expect(timer.elapsedMilliseconds).toBe(8 * 60_000);
  });

  it('logs nothing for a stretch under a minute on its own', async () => {
    const { manager, logs } = fakeManager();
    const timer = running('10:00:00');
    timer.elapsedMilliseconds = 30 * 60_000;
    await pause(manager, timer, '10:00:20');
    expect(logs).toEqual([]);
    expect(timer.elapsedMilliseconds).toBe(30 * 60_000);
    // Resumed later, it is still a stretch of its own: nothing to continue.
    resumeWorkSegment(timer, at('10:02:00'));
    await pause(manager, timer, '10:02:20');
    expect(logs).toEqual([]);
  });

  it('extends the previous log by a short stretch resumed within a minute', async () => {
    const { manager, logs } = fakeManager();
    const timer = running('10:00:00');
    await pause(manager, timer, '10:10:00');
    resumeWorkSegment(timer, at('10:10:30'));
    await pause(manager, timer, '10:10:50');
    expect(spans(logs)).toEqual([['10:00:00', '10:10:50']]);
    expect(timer.elapsedMilliseconds).toBe(10 * 60_000 + 50_000);
  });

  it('joins short stretches that together make a block of a minute', async () => {
    const { manager, logs } = fakeManager();
    const timer = running('10:00:00');
    await pause(manager, timer, '10:00:30');
    resumeWorkSegment(timer, at('10:00:40'));
    await pause(manager, timer, '10:01:10');
    expect(spans(logs)).toEqual([['10:00:00', '10:01:10']]);
    expect(timer.elapsedMilliseconds).toBe(70_000);
  });

  it('starts anew when the log of the block was deleted meanwhile', async () => {
    const { manager, logs } = fakeManager();
    const timer = running('10:00:00');
    await pause(manager, timer, '10:05:00');
    logs.splice(0);
    resumeWorkSegment(timer, at('10:05:10'));
    await pause(manager, timer, '10:07:00');
    expect(spans(logs)).toEqual([['10:00:00', '10:07:00']]);
  });
});
