import { BadRequestException } from '@nestjs/common';
import { atWallClockMinutes } from '../common/date/local-day';
import {
  assertChallengeMonth,
  challengeDay,
  challengeReminderDecision,
  challengeStatus,
  challengeWindow,
  monthEnd,
  monthFromKey,
  monthOf,
  nextMonth,
  startDateFor,
  type ChallengeReminderState,
} from './challenge-rules';

describe('Monats-Challenge: month and days', () => {
  it('finds the month, the next one and its last day', () => {
    expect(monthOf('2026-11-23')).toBe('2026-11-01');
    expect(nextMonth('2026-11-01')).toBe('2026-12-01');
    expect(nextMonth('2026-12-01')).toBe('2027-01-01');
    expect(nextMonth('2027-01-01')).toBe('2027-02-01');
    expect(monthEnd('2026-11-01')).toBe('2026-11-30');
    expect(monthEnd('2027-02-01')).toBe('2027-02-28');
    expect(monthEnd('2028-02-01')).toBe('2028-02-29');
    expect(monthEnd('2026-12-01')).toBe('2026-12-31');
  });

  it('takes this month or the next, nothing else', () => {
    expect(monthFromKey('2026-12')).toBe('2026-12-01');
    expect(() => monthFromKey('2026-13')).toThrow(BadRequestException);
    expect(() =>
      assertChallengeMonth('2026-11-01', '2026-11-23'),
    ).not.toThrow();
    expect(() =>
      assertChallengeMonth('2026-12-01', '2026-11-23'),
    ).not.toThrow();
    expect(() => assertChallengeMonth('2027-01-01', '2026-11-23')).toThrow(
      'Eine Monats-Challenge gibt es nur für diesen oder den nächsten Monat.',
    );
    expect(() => assertChallengeMonth('2026-10-01', '2026-11-23')).toThrow(
      BadRequestException,
    );
  });

  it('begins today in the running month, on the first in the next', () => {
    expect(startDateFor('2026-11-01', '2026-11-23')).toBe('2026-11-23');
    expect(startDateFor('2026-12-01', '2026-11-23')).toBe('2026-12-01');
  });

  it('counts to the month end, or to the day it was ended', () => {
    const running = {
      month: '2026-11-01',
      startDate: '2026-11-05',
      endedAt: null,
    };
    expect(challengeWindow(running)).toEqual({
      first: '2026-11-05',
      last: '2026-11-30',
    });
    expect(
      challengeWindow({
        ...running,
        endedAt: atWallClockMinutes('2026-11-14', 21 * 60),
      }),
    ).toEqual({ first: '2026-11-05', last: '2026-11-14' });
    expect(
      challengeDay({ first: '2026-11-05', last: '2026-11-30' }, '2026-11-16'),
    ).toBe(12);
    expect(
      challengeDay({ first: '2026-11-05', last: '2026-11-30' }, '2026-11-04'),
    ).toBeNull();
  });

  it('is done only at 100 % once the month is over', () => {
    const challenge = {
      month: '2026-11-01',
      startDate: '2026-11-01',
      endedAt: null,
      doneCount: null,
      dueCount: null,
    };
    expect(challengeStatus(challenge, '2026-10-20')).toBe('upcoming');
    expect(challengeStatus(challenge, '2026-11-30')).toBe('running');
    expect(
      challengeStatus(
        { ...challenge, doneCount: 30, dueCount: 30 },
        '2026-12-01',
      ),
    ).toBe('succeeded');
    expect(
      challengeStatus(
        { ...challenge, doneCount: 27, dueCount: 30 },
        '2026-12-01',
      ),
    ).toBe('finished');
    // Nothing was ever due: no success to claim.
    expect(
      challengeStatus(
        { ...challenge, doneCount: 0, dueCount: 0 },
        '2026-12-01',
      ),
    ).toBe('finished');
    expect(
      challengeStatus(
        { ...challenge, endedAt: new Date('2026-11-10T10:00:00Z') },
        '2026-11-12',
      ),
    ).toBe('ended');
  });
});

describe('Monats-Challenge: the daily reminder', () => {
  const state = (
    change: Partial<ChallengeReminderState> = {},
  ): ChallengeReminderState => ({
    reminderMinutes: 19 * 60,
    remindedOn: null,
    running: true,
    runOpen: true,
    ...change,
  });
  const at = (day: string, minutes: number) => atWallClockMinutes(day, minutes);

  it('comes at its time while the run of today is open', () => {
    const day = '2026-11-23';
    expect(challengeReminderDecision(at(day, 19 * 60 - 1), state())).toEqual({
      kind: 'wait',
      day,
    });
    expect(challengeReminderDecision(at(day, 19 * 60), state())).toEqual({
      kind: 'send',
      day,
      dueAt: at(day, 19 * 60),
      expiresAt: at(day, 20 * 60),
    });
  });

  it('stays away when off, handled today, not running, or the run is done', () => {
    const day = '2026-11-23';
    const due = at(day, 19 * 60 + 5);
    expect(
      challengeReminderDecision(due, state({ reminderMinutes: null })).kind,
    ).toBe('none');
    expect(
      challengeReminderDecision(due, state({ remindedOn: day })).kind,
    ).toBe('none');
    expect(challengeReminderDecision(due, state({ running: false })).kind).toBe(
      'none',
    );
    // Done, skipped or not due today: handled without a push.
    expect(challengeReminderDecision(due, state({ runOpen: false }))).toEqual({
      kind: 'settled',
      day,
    });
    // Yesterday's handling does not hold today.
    expect(
      challengeReminderDecision(due, state({ remindedOn: '2026-11-22' })).kind,
    ).toBe('send');
  });

  it('is not caught up once its hour passed unsent', () => {
    const day = '2026-11-23';
    expect(challengeReminderDecision(at(day, 20 * 60), state())).toEqual({
      kind: 'missed',
      day,
    });
  });

  it('keeps its wall-clock time across daylight saving', () => {
    // Saturday before the spring change (CET), the Sunday of it (CEST).
    expect(
      challengeReminderDecision(new Date('2026-03-28T18:00:00Z'), state()),
    ).toMatchObject({ kind: 'send', dueAt: new Date('2026-03-28T18:00:00Z') });
    expect(
      challengeReminderDecision(new Date('2026-03-29T17:00:00Z'), state()),
    ).toMatchObject({ kind: 'send', dueAt: new Date('2026-03-29T17:00:00Z') });
    // 18:00 UTC on that Sunday is 20:00 in Berlin: its hour is over.
    expect(
      challengeReminderDecision(new Date('2026-03-29T18:00:00Z'), state()).kind,
    ).toBe('missed');
    // The autumn change (back to CET) on Sunday 25 October.
    expect(
      challengeReminderDecision(new Date('2026-10-25T17:59:00Z'), state()).kind,
    ).toBe('wait');
    expect(
      challengeReminderDecision(new Date('2026-10-25T18:00:00Z'), state()),
    ).toMatchObject({ kind: 'send', dueAt: new Date('2026-10-25T18:00:00Z') });
  });

  it('never runs past midnight', () => {
    const day = '2026-11-23';
    const late = state({ reminderMinutes: 23 * 60 + 30 });
    expect(
      challengeReminderDecision(at(day, 23 * 60 + 40), late),
    ).toMatchObject({
      kind: 'send',
      expiresAt: at('2026-11-24', 0),
    });
  });
});
