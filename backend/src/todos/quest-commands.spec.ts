import { BadRequestException, ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { TimerEntity } from '../timers/timer.entity';
import { TodoEntity } from './entities/todo.entity';
import {
  resumeQuestWork,
  saveQuest,
  setQuestAside,
  takeQuestIntoWork,
} from './quest-commands';

const USER = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-02T12:00:00Z');

function quest(fields: Partial<TodoEntity> = {}): TodoEntity {
  return Object.assign(new TodoEntity(), {
    id: 1,
    userId: USER,
    title: 'Bericht',
    completed: false,
    completedAt: null,
    scheduledDate: null,
    timeOfDay: null,
    dayPosition: null,
    backlogPosition: null,
    ...fields,
  });
}

/**
 * An in-memory store with what the commands read and write: saved quests,
 * the edge of the Questlog's order, the open stopwatches of quests and the
 * fields written without loading the quest.
 */
function store(lastBacklog: number | null, timers: TimerEntity[] = []) {
  const saved: TodoEntity[] = [];
  const stopped: TimerEntity[] = [];
  const updated: Partial<TodoEntity>[] = [];
  const query = (result: unknown) => {
    const chain = {
      select: () => chain,
      where: () => chain,
      andWhere: () => chain,
      // Ending a Fokus-Sperre with the stopwatch or the quest.
      update: () => chain,
      set: () => chain,
      setParameter: () => chain,
      execute: () => Promise.resolve(),
      getRawOne: () => Promise.resolve({ edge: lastBacklog }),
      getMany: () => Promise.resolve(result),
    };
    return chain;
  };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === TimerEntity
        ? { createQueryBuilder: () => query(timers) }
        : {
            createQueryBuilder: () => query([]),
            save: (todo: TodoEntity) => {
              saved.push(Object.assign(new TodoEntity(), todo));
              return Promise.resolve(todo);
            },
          },
    save: (_entity: unknown, timer: TimerEntity) => {
      stopped.push(timer);
      return Promise.resolve(timer);
    },
    update: (
      _entity: unknown,
      _where: unknown,
      fields: Partial<TodoEntity>,
    ) => {
      updated.push(fields);
      return Promise.resolve();
    },
  } as unknown as EntityManager;
  return { manager, saved, stopped, updated };
}

function runningTimer(): TimerEntity {
  return Object.assign(new TimerEntity(), {
    id: 't',
    userId: USER,
    todoId: 1,
    occurrenceId: null,
    title: 'Bericht',
    state: 'running',
    targetMinutes: null,
    elapsedMilliseconds: 0,
    idleMilliseconds: 0,
    // Started just now: too short for a log.
    segmentStartedAt: new Date(NOW.getTime() - 10_000),
    blockStartedAt: null,
    pausedAt: null,
    workLogId: null,
    targetReachesAt: null,
  });
}

describe('saveQuest', () => {
  it('joins another day at the end of its order and leaves the Questlog', async () => {
    const { manager, saved } = store(4);
    const todo = quest({ backlogPosition: 2, dayPosition: 3 });
    await saveQuest(manager, todo, { scheduledDate: '2026-10-05' }, NOW);
    expect(saved).toEqual([
      expect.objectContaining({
        scheduledDate: '2026-10-05',
        dayPosition: null,
        backlogPosition: null,
      }),
    ]);
  });

  it('keeps its place when the day stays', async () => {
    const { manager } = store(null);
    const todo = quest({ scheduledDate: '2026-10-02', dayPosition: 2 });
    await saveQuest(manager, todo, { scheduledDate: '2026-10-02' }, NOW);
    expect(todo.dayPosition).toBe(2);
  });

  it('puts a quest that loses its day at the end of the Questlog, without its time', async () => {
    const { manager } = store(6);
    const todo = quest({
      scheduledDate: '2026-10-02',
      timeOfDay: '10:00',
      dayPosition: 3,
    });
    await saveQuest(manager, todo, { scheduledDate: null }, NOW);
    expect(todo).toMatchObject({
      scheduledDate: null,
      timeOfDay: null,
      dayPosition: null,
      backlogPosition: 7,
    });
    const first = quest({ scheduledDate: '2026-10-02' });
    await saveQuest(store(null).manager, first, { scheduledDate: null }, NOW);
    expect(first.backlogPosition).toBe(0);
  });

  it('leaves a quest without a place in the Questlog when asked', async () => {
    const { manager } = store(6);
    const todo = quest({ scheduledDate: '2026-10-02', timeOfDay: '10:00' });
    await saveQuest(manager, todo, { scheduledDate: null }, NOW, {
      backlogPlace: 'none',
    });
    expect(todo).toMatchObject({ scheduledDate: null, backlogPosition: null });
  });

  it('anchors a quest anew when its time changes', async () => {
    const { manager } = store(null);
    const todo = quest({ scheduledDate: '2026-10-02', dayPosition: 1 });
    await saveQuest(manager, todo, { timeOfDay: '09:00' }, NOW);
    expect(todo).toMatchObject({ timeOfDay: '09:00', dayPosition: null });
    todo.dayPosition = 4;
    await saveQuest(manager, todo, { timeOfDay: '09:00' }, NOW);
    expect(todo.dayPosition).toBe(4);
  });

  it('refuses a time without a day and saves nothing', async () => {
    const { manager, saved } = store(null);
    await expect(
      saveQuest(manager, quest(), { timeOfDay: '10:00' }, NOW),
    ).rejects.toThrow(BadRequestException);
    await expect(
      saveQuest(
        manager,
        quest({ scheduledDate: '2026-10-02', timeOfDay: '10:00' }),
        { scheduledDate: '2026-13-40' },
        NOW,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(saved).toEqual([]);
  });

  it('stamps a completion once and clears it on reopening', async () => {
    const { manager } = store(null);
    const todo = quest();
    await saveQuest(manager, todo, { completed: true }, NOW);
    expect(todo.completedAt).toEqual(NOW);
    await saveQuest(manager, todo, { completed: true }, new Date());
    expect(todo.completedAt).toEqual(NOW);
    await saveQuest(manager, todo, { completed: false }, NOW);
    expect(todo).toMatchObject({
      completed: false,
      completedAt: null,
      setAsideAt: NOW,
    });
  });

  it('lifts the "Geblockt" marker of a quest it completes', async () => {
    const { manager } = store(null);
    const blocked = quest({ blocked: true });
    await saveQuest(manager, blocked, { scheduledDate: '2026-10-03' }, NOW);
    expect(blocked.blocked).toBe(true);
    await saveQuest(manager, blocked, { completed: true }, NOW);
    expect(blocked.blocked).toBe(false);
  });

  it('marks and unmarks "Geblockt", but not on a quest that is or becomes completed', async () => {
    const { manager, saved } = store(null);
    const todo = quest();
    await saveQuest(manager, todo, { blocked: true }, NOW);
    expect(todo.blocked).toBe(true);
    await saveQuest(manager, todo, { blocked: false, completed: true }, NOW);
    expect(todo).toMatchObject({ blocked: false, completed: true });
    await expect(
      saveQuest(manager, todo, { blocked: true }, NOW),
    ).rejects.toThrow(
      new ConflictException('Erledigte Quests können nicht geblockt werden.'),
    );
    await expect(
      saveQuest(manager, quest(), { blocked: true, completed: true }, NOW),
    ).rejects.toThrow(ConflictException);
    expect(saved).toHaveLength(2);
    // Reopened in the same change, it may be blocked.
    await saveQuest(manager, todo, { blocked: true, completed: false }, NOW);
    expect(todo).toMatchObject({ blocked: true, setAsideAt: NOW });
  });

  it('ends the stopwatch of a quest it completes, not of one it edits', async () => {
    const timer = runningTimer();
    const { manager, stopped } = store(null, [timer]);
    await saveQuest(manager, quest(), { scheduledDate: '2026-10-03' }, NOW);
    expect(stopped).toEqual([]);
    await saveQuest(manager, quest(), { completed: true }, NOW);
    expect(stopped).toEqual([
      expect.objectContaining({ id: 't', state: 'stopped' }),
    ]);
  });
});

describe('setQuestAside', () => {
  it('stamps the moment, sets the marker and ends the stopwatch', async () => {
    const { manager, saved, stopped } = store(null, [runningTimer()]);
    await setQuestAside(manager, quest({ blocked: false }), true, NOW);
    expect(saved).toEqual([
      expect.objectContaining({ setAsideAt: NOW, blocked: true }),
    ]);
    expect(stopped).toEqual([
      expect.objectContaining({ id: 't', state: 'stopped' }),
    ]);
  });

  it('refuses a completed quest with 409 and stops nothing', async () => {
    const { manager, saved, stopped } = store(null, [runningTimer()]);
    await expect(
      setQuestAside(manager, quest({ completed: true }), false, NOW),
    ).rejects.toThrow(
      new ConflictException(
        'Erledigte Quests können nicht zurückgelegt werden.',
      ),
    );
    expect(saved).toEqual([]);
    expect(stopped).toEqual([]);
  });
});

describe('takeQuestIntoWork', () => {
  it('stamps the moment, lifts the marker and starts no stopwatch', async () => {
    const { manager, saved, stopped } = store(null, [runningTimer()]);
    await takeQuestIntoWork(manager, quest({ blocked: true }), NOW);
    expect(saved).toEqual([
      expect.objectContaining({ startedAt: NOW, blocked: false }),
    ]);
    expect(stopped).toEqual([]);
  });

  it('refuses a completed quest with 409', async () => {
    const { manager, saved } = store(null);
    await expect(
      takeQuestIntoWork(manager, quest({ completed: true }), NOW),
    ).rejects.toThrow(
      new ConflictException(
        'Erledigte Quests können nicht in Arbeit genommen werden.',
      ),
    );
    expect(saved).toEqual([]);
  });
});

describe('resumeQuestWork', () => {
  it('lifts "Geblockt" and writes only that, and nothing when unmarked', async () => {
    const { manager, saved, updated } = store(null);
    const blocked = quest({ blocked: true });
    await resumeQuestWork(manager, blocked);
    expect(blocked.blocked).toBe(false);
    expect(updated).toEqual([{ blocked: false }]);
    await resumeQuestWork(manager, blocked);
    expect(updated).toHaveLength(1);
    expect(saved).toEqual([]);
  });
});
