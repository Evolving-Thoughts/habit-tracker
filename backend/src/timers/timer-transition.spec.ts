import { elapsedAt, MAX_SEGMENT_MS, unloggedBlock } from './timer-math';
import {
  LogOperation,
  startedStopwatch,
  StopwatchEvent,
  StopwatchState,
  transition,
} from './timer-transition';

type Log = { id: number; startedAt: Date; endedAt: Date };

const at = (time: string): Date => new Date(`2026-11-20T${time}Z`);

/**
 * A stopwatch with an in-memory Logbuch: every event goes through
 * `transition`, and its log operations are applied the way
 * `recordTransition` applies them to the database.
 */
class Bench {
  logs: Log[] = [];
  ops: LogOperation[][] = [];
  state: StopwatchState;
  constructor(from: string, elapsed = 0) {
    this.state = startedStopwatch(elapsed, null, at(from));
  }
  private apply(type: 'pause' | 'stop' | 'resume', time: string): void {
    const log = this.logs.find((entry) => entry.id === this.state.workLogId);
    const next = transition(
      this.state,
      type === 'resume'
        ? { type }
        : { type, blockLog: log ? { startedAt: log.startedAt } : null },
      at(time),
    );
    this.ops.push(next.logOps);
    for (const op of next.logOps) {
      if (op.type === 'extend') {
        this.logs.find((entry) => entry.id === op.id)!.endedAt = op.endedAt;
        continue;
      }
      const id = this.logs.length + 1;
      this.logs.push({ id, startedAt: op.startedAt, endedAt: op.endedAt });
      if (op.isBlockLog) next.state.workLogId = id;
    }
    this.state = next.state;
  }
  pause = (time: string) => this.apply('pause', time);
  resume = (time: string) => this.apply('resume', time);
  stop = (time: string) => this.apply('stop', time);
  shown = (time: string) => elapsedAt(this.state, at(time));
  spans = () =>
    this.logs.map(({ startedAt, endedAt }) => [
      startedAt.toISOString().slice(11, 19),
      endedAt.toISOString().slice(11, 19),
    ]);
}

describe('The time a stopwatch shows', () => {
  it('keeps a stretch under a minute in view while paused', () => {
    const watch = new Bench('10:00:00');
    watch.pause('10:00:40');
    expect(watch.logs).toEqual([]);
    expect(watch.shown('10:00:50')).toBe(40_000);
    expect(unloggedBlock(watch.state)).toBe(40_000);
    // Resumed within the minute, it counts on from there.
    watch.resume('10:00:55');
    expect(watch.shown('10:00:55')).toBe(40_000);
    expect(watch.shown('10:01:05')).toBe(50_000);
  });

  it('never jumps on resume or pause, whatever the pause', () => {
    const watch = new Bench('10:00:00', 30 * 60_000);
    // A short stretch, a long pause, then on again.
    watch.pause('10:00:20');
    expect(watch.shown('10:05:00')).toBe(30 * 60_000 + 20_000);
    watch.resume('10:05:00');
    expect(watch.shown('10:05:00')).toBe(30 * 60_000 + 20_000);
    // A long stretch, a short pause, a long pause.
    expect(watch.shown('10:10:00')).toBe(30 * 60_000 + 20_000 + 5 * 60_000);
    watch.pause('10:10:00');
    expect(watch.shown('10:10:00')).toBe(30 * 60_000 + 20_000 + 5 * 60_000);
    watch.resume('10:10:30');
    watch.pause('10:12:00');
    const shown = 30 * 60_000 + 20_000 + 5 * 60_000 + 90_000;
    expect(watch.shown('10:12:30')).toBe(shown);
    watch.resume('10:20:00');
    expect(watch.shown('10:20:00')).toBe(shown);
    expect(watch.shown('10:21:00')).toBe(shown + 60_000);
  });

  it('keeps what it showed when it is ended', () => {
    const watch = new Bench('10:00:00');
    watch.pause('10:05:00');
    watch.resume('10:05:30');
    watch.stop('10:08:00');
    expect(watch.state.state).toBe('stopped');
    expect(watch.spans()).toEqual([['10:00:00', '10:08:00']]);
  });
});

describe('Work blocks of a stopwatch', () => {
  it('continues one log when resumed within a minute of the pause', () => {
    const watch = new Bench('10:00:00');
    watch.pause('10:05:00');
    watch.resume('10:05:40');
    // Within the block: no write, the stretch starts where the block did.
    expect(watch.ops.at(-1)).toEqual([]);
    expect(watch.state.segmentStartedAt).toEqual(at('10:00:00'));
    // The log counts the pause, the stopwatch does not: it runs on from 5:00.
    expect(watch.shown('10:05:40')).toBe(5 * 60_000);
    expect(watch.shown('10:06:00')).toBe(5 * 60_000 + 20_000);
    watch.pause('10:08:00');
    expect(watch.ops.at(-1)).toEqual([
      { type: 'extend', id: 1, endedAt: at('10:08:00') },
    ]);
    expect(watch.spans()).toEqual([['10:00:00', '10:08:00']]);
    expect(watch.shown('10:09:00')).toBe(7 * 60_000 + 20_000);
  });

  it('starts a second log after a pause of a minute or more', () => {
    const watch = new Bench('10:00:00');
    watch.pause('10:05:00');
    watch.resume('10:06:00');
    watch.pause('10:09:00');
    expect(watch.spans()).toEqual([
      ['10:00:00', '10:05:00'],
      ['10:06:00', '10:09:00'],
    ]);
    expect(watch.state.elapsedMilliseconds).toBe(8 * 60_000);
  });

  it('logs a block under a minute only once work resumes after the gap', () => {
    const watch = new Bench('10:00:00', 30 * 60_000);
    watch.pause('10:00:20');
    // Maybe a mis-tap: no log yet.
    expect(watch.logs).toEqual([]);
    expect(watch.state.elapsedMilliseconds).toBe(30 * 60_000);
    // Resumed later, it was work: it gets its own log, the new stretch
    // starts a block of its own.
    watch.resume('10:02:00');
    expect(watch.ops.at(-1)).toEqual([
      {
        type: 'insert',
        startedAt: at('10:00:00'),
        endedAt: at('10:00:20'),
        isBlockLog: false,
      },
    ]);
    expect(watch.state.workLogId).toBeNull();
    expect(watch.shown('10:02:00')).toBe(30 * 60_000 + 20_000);
    // A short stretch that is the last one stays unlogged.
    watch.pause('10:02:20');
    expect(watch.spans()).toEqual([['10:00:00', '10:00:20']]);
  });

  it('writes no log for a stopwatch ended right away', () => {
    const watch = new Bench('10:00:00');
    watch.stop('10:00:30');
    expect(watch.logs).toEqual([]);
    expect(watch.state).toMatchObject({
      state: 'stopped',
      segmentStartedAt: null,
      elapsedMilliseconds: 0,
    });
    // Nor for one paused briefly and then ended.
    const paused = new Bench('10:00:00');
    paused.pause('10:00:30');
    paused.stop('10:03:00');
    expect(paused.logs).toEqual([]);
  });

  it('logs a block of a minute when it ends', () => {
    const watch = new Bench('10:00:00');
    watch.stop('10:01:00');
    expect(watch.spans()).toEqual([['10:00:00', '10:01:00']]);
    expect(watch.state.workLogId).toBe(1);
  });

  it('extends the previous log by a short stretch resumed within a minute', () => {
    const watch = new Bench('10:00:00');
    watch.pause('10:10:00');
    watch.resume('10:10:30');
    watch.pause('10:10:50');
    expect(watch.spans()).toEqual([['10:00:00', '10:10:50']]);
    expect(watch.state.elapsedMilliseconds).toBe(10 * 60_000 + 50_000);
  });

  it('joins short stretches that together make a block of a minute', () => {
    const watch = new Bench('10:00:00');
    watch.pause('10:00:30');
    watch.resume('10:00:40');
    watch.pause('10:01:10');
    expect(watch.spans()).toEqual([['10:00:00', '10:01:10']]);
    expect(watch.state.elapsedMilliseconds).toBe(70_000);
  });

  it('starts anew when the log of the block was deleted meanwhile', () => {
    const watch = new Bench('10:00:00');
    watch.pause('10:05:00');
    watch.logs.splice(0);
    watch.resume('10:05:10');
    watch.pause('10:07:00');
    expect(watch.spans()).toEqual([['10:00:00', '10:07:00']]);
  });

  it('starts anew when the log was corrected to start after the new end', () => {
    const watch = new Bench('10:00:00');
    watch.pause('10:05:00');
    watch.logs[0].startedAt = at('10:30:00');
    watch.resume('10:05:10');
    watch.pause('10:07:00');
    expect(watch.ops.at(-1)).toEqual([
      {
        type: 'insert',
        startedAt: at('10:00:00'),
        endedAt: at('10:07:00'),
        isBlockLog: true,
      },
    ]);
  });

  it('cuts a stretch nobody ended at its limit', () => {
    const watch = new Bench('10:00:00');
    watch.pause('23:59:00');
    expect(watch.spans()).toEqual([
      [
        '10:00:00',
        new Date(at('10:00:00').getTime() + MAX_SEGMENT_MS)
          .toISOString()
          .slice(11, 19),
      ],
    ]);
    expect(watch.state.elapsedMilliseconds).toBe(MAX_SEGMENT_MS);
  });

  it('touches nothing it was not given', () => {
    const before = new Bench('10:00:00').state;
    const frozen = { ...before };
    transition(before, { type: 'pause' }, at('10:05:00'));
    expect(before).toEqual(frozen);
  });
});

type Soll = Pick<
  StopwatchState,
  'targetReachesAt' | 'targetReachedAt' | 'pushHandledAt'
>;
type Step = [StopwatchEvent, string];

const instant = (time: string | null) => (time === null ? null : at(time));

const soll = (
  reachesAt: string | null,
  reachedAt: string | null,
  handledAt: string | null,
): Soll => ({
  targetReachesAt: instant(reachesAt),
  targetReachedAt: instant(reachedAt),
  pushHandledAt: instant(handledAt),
});

describe('The Soll of a stopwatch', () => {
  // Started at 10:00 on nothing logged with a 30-minute Soll: due at 10:30.
  const fresh = (logged = 0, minutes: number | null = 30) =>
    startedStopwatch(logged, minutes, at('10:00:00'));
  const reached: Step[] = [[{ type: 'reach' }, '10:30:00']];

  it.each<[string, StopwatchState, Step[], Soll]>([
    ['start: due at its moment', fresh(), [], soll('10:30:00', null, null)],
    [
      'start on logged time: due that much earlier',
      fresh(10 * 60_000),
      [],
      soll('10:20:00', null, null),
    ],
    [
      'start with logged time past the Soll: reached silently',
      fresh(40 * 60_000),
      [],
      soll(null, '10:00:00', '10:00:00'),
    ],
    [
      'start without a Soll: nothing',
      fresh(0, null),
      [],
      soll(null, null, null),
    ],
    [
      'pause clears due',
      fresh(),
      [[{ type: 'pause' }, '10:10:00']],
      soll(null, null, null),
    ],
    [
      'resume recomputes due',
      fresh(),
      [
        [{ type: 'pause' }, '10:10:00'],
        [{ type: 'resume' }, '10:20:00'],
      ],
      soll('10:40:00', null, null),
    ],
    [
      'resume within the block: the short pause is not counted',
      fresh(),
      [
        [{ type: 'pause' }, '10:10:00'],
        [{ type: 'resume' }, '10:10:30'],
      ],
      soll('10:30:30', null, null),
    ],
    [
      'reach: reached, nothing due',
      fresh(),
      reached,
      soll(null, '10:30:00', null),
    ],
    [
      'resume after reached stays reached with nothing due',
      fresh(),
      [
        ...reached,
        [{ type: 'pause' }, '10:40:00'],
        [{ type: 'resume' }, '10:50:00'],
      ],
      soll(null, '10:30:00', null),
    ],
    [
      'stop clears due',
      fresh(),
      [[{ type: 'stop' }, '10:10:00']],
      soll(null, null, null),
    ],
    [
      'push handled: marked',
      fresh(),
      [...reached, [{ type: 'markPushHandled' }, '10:30:01']],
      soll(null, '10:30:00', '10:30:01'),
    ],
    [
      'new target below elapsed is reached silently',
      fresh(),
      [[{ type: 'changeTarget', minutes: 5 }, '10:10:00']],
      soll(null, '10:10:00', '10:10:00'),
    ],
    [
      'new target below elapsed keeps an earlier reach',
      fresh(),
      [...reached, [{ type: 'changeTarget', minutes: 20 }, '10:40:00']],
      soll(null, '10:30:00', null),
    ],
    [
      'new target above elapsed clears reached and handled and computes due',
      fresh(),
      [
        ...reached,
        [{ type: 'markPushHandled' }, '10:30:01'],
        [{ type: 'changeTarget', minutes: 60 }, '10:40:00'],
      ],
      soll('11:00:00', null, null),
    ],
    [
      'new target above elapsed while paused: nothing due until resumed',
      fresh(),
      [
        ...reached,
        [{ type: 'pause' }, '10:40:00'],
        [{ type: 'changeTarget', minutes: 60 }, '10:45:00'],
      ],
      soll(null, null, null),
    ],
  ])('%s', (_name, start, steps, expected) => {
    // A block log gets an id, as `recordTransition` gives it.
    const end = steps.reduce((state, [event, time]) => {
      const next = transition(state, event, at(time));
      if (next.logOps.some((op) => op.type === 'insert' && op.isBlockLog))
        next.state.workLogId = 1;
      return next.state;
    }, start);
    expect(end).toMatchObject(expected);
  });

  it('takes the new minutes and leaves the time worked alone', () => {
    const before = fresh();
    const { state, logOps } = transition(
      before,
      { type: 'changeTarget', minutes: 45 },
      at('10:10:00'),
    );
    expect(logOps).toEqual([]);
    expect(state).toEqual({
      ...before,
      targetMinutes: 45,
      targetReachesAt: at('10:45:00'),
    });
  });
});
