import { HabitOccurrenceStatus as Status } from '../../habit-occurrences/enums/habit-occurrence-status.enum';
import { ScheduleDto } from '../dto/schedule.dto';
import { HabitScheduleVersionEntity } from '../entities/habit-schedule-version.entity';
import { buildVersion, normalizeSchedule } from './schedule-rules';
import {
  RunAtHand,
  RunRefusal,
  runRefusal,
  RunRuleOptions,
} from './run-actionability';

// Friday 2026-11-20, 11:00 in Berlin.
const NOW = new Date('2026-11-20T10:00:00.000Z');
const ACTIVE = { isActive: true };
const PAUSED = { isActive: false };

const version = (
  policy: 'skip' | 'carry_over',
  intervalDays: number,
  overrides: Partial<HabitScheduleVersionEntity> = {},
): HabitScheduleVersionEntity =>
  Object.assign(
    buildVersion(
      1,
      normalizeSchedule({
        type: 'interval',
        intervalDays,
        missedOccurrencePolicy: policy,
      } as ScheduleDto),
      // 2026-11-01, midnight in Berlin.
      new Date('2026-10-31T23:00:00.000Z'),
    ),
    { id: 1, endsAt: null, cancelledAt: null, ...overrides },
  );

/** Every day; a run's window closes at the next midnight. */
const daily = (overrides?: Partial<HabitScheduleVersionEntity>) =>
  version('skip', 1, overrides);
/** Every third day from Nov 1 (…, 19, 22); a run waits for the next slot. */
const everyThird = version('carry_over', 3);

const run = (
  scheduledDate: string,
  status = Status.PENDING,
  movedToDate: string | null = null,
) => ({ scheduledDate, status, movedToDate });

const today = run('2026-11-20');

type Row = [
  string,
  Partial<RunAtHand>,
  RunRuleOptions | undefined,
  RunRefusal | null,
];

const at = (row: Partial<RunAtHand>): RunAtHand => ({
  run: today,
  version: daily(),
  habit: ACTIVE,
  now: NOW,
  ...row,
});

describe('runRefusal', () => {
  it.each<Row>([
    ["today's open run", {}, undefined, null],
    [
      'a run carried over into today',
      { run: run('2026-11-19'), version: everyThird },
      undefined,
      null,
    ],
    [
      'a run moved into today',
      {
        run: run('2026-11-19', Status.PENDING, '2026-11-20'),
        version: everyThird,
      },
      undefined,
      null,
    ],
    ['a run of a paused habit', { habit: PAUSED }, undefined, 'paused'],
    ['a run without its habit', { habit: undefined }, undefined, 'paused'],
    [
      'a completed run',
      { run: run('2026-11-20', Status.COMPLETED) },
      undefined,
      'resolved',
    ],
    [
      'a skipped run',
      { run: run('2026-11-20', Status.SKIPPED) },
      undefined,
      'resolved',
    ],
    [
      'a cancelled run',
      { run: run('2026-11-20', Status.CANCELLED) },
      undefined,
      'resolved',
    ],
    [
      'a run of a version that ended',
      { version: daily({ endsAt: new Date('2026-11-20T09:00:00.000Z') }) },
      undefined,
      'other_version',
    ],
    [
      'a run of a cancelled version',
      { version: daily({ cancelledAt: new Date('2026-11-01T10:00:00.000Z') }) },
      undefined,
      'other_version',
    ],
    [
      'a run of a version not in force yet',
      { version: daily({ effectiveAt: new Date('2026-11-21T10:00:00.000Z') }) },
      undefined,
      'other_version',
    ],
    [
      'a run of an unknown version',
      { version: undefined },
      undefined,
      'other_version',
    ],
    [
      'a run moved to tomorrow',
      { run: run('2026-11-20', Status.PENDING, '2026-11-21') },
      undefined,
      'moved_ahead',
    ],
    [
      "yesterday's run when the window closed at midnight",
      { run: run('2026-11-19') },
      undefined,
      'ran_out',
    ],
    [
      'a paused habit before anything else',
      { habit: PAUSED, run: run('2026-11-19', Status.CANCELLED) },
      undefined,
      'paused',
    ],
    // What a caller leaves out.
    [
      'a completed run, to reopen it',
      { run: run('2026-11-20', Status.COMPLETED) },
      { resolved: true },
      null,
    ],
    [
      'a skipped run, to reopen it',
      { run: run('2026-11-20', Status.SKIPPED) },
      { resolved: true },
      null,
    ],
    [
      'a cancelled run, never reopened',
      { run: run('2026-11-20', Status.CANCELLED) },
      { resolved: true },
      'resolved',
    ],
    [
      'a completed run whose window closed',
      { run: run('2026-11-19', Status.COMPLETED) },
      { resolved: true },
      'ran_out',
    ],
    [
      'a run moved to tomorrow, to move it again',
      { run: run('2026-11-20', Status.PENDING, '2026-11-21') },
      { movedAhead: true },
      null,
    ],
    [
      'a run of a version that ended, any version counting',
      { version: daily({ endsAt: new Date('2026-11-20T09:00:00.000Z') }) },
      { anyVersion: true },
      null,
    ],
    [
      'a run of a cancelled version, any version counting',
      { version: daily({ cancelledAt: new Date('2026-11-01T10:00:00.000Z') }) },
      { anyVersion: true },
      'other_version',
    ],
    [
      'a run that ran out, any version counting',
      { run: run('2026-11-19') },
      { anyVersion: true },
      'ran_out',
    ],
    [
      'a run of a paused habit, the pause not looked at',
      { habit: PAUSED },
      { ignorePause: true },
      null,
    ],
    [
      'a run without its habit, the pause not looked at',
      { habit: undefined },
      { ignorePause: true },
      null,
    ],
  ])('%s', (_name, row, options, expected) => {
    expect(runRefusal(at(row), options)).toBe(expected);
  });
});
