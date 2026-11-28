import { BadRequestException } from '@nestjs/common';
import {
  assertRange,
  MAX_RANGE_DAYS,
  minutesOfTime,
  normalizeDayBestText,
  reminderDecision,
  reminderWindow,
  timeOfMinutes,
  type ReminderState,
} from './day-best-rules';

describe('Das Beste des Tages: the line', () => {
  it('is one line, trimmed, whitespace collapsed', () => {
    expect(normalizeDayBestText('  Sonne\n\nam   See \t ')).toBe(
      'Sonne am See',
    );
    expect(normalizeDayBestText(' \n ')).toBe('');
  });

  it('reads ranges in order and of bounded length', () => {
    expect(() => assertRange('2026-09-01', '2026-11-30')).not.toThrow();
    expect(() => assertRange('2026-11-30', '2026-09-01')).toThrow(
      BadRequestException,
    );
    expect(() => assertRange('2025-01-01', '2026-11-30')).toThrow(
      `Höchstens ${MAX_RANGE_DAYS} Tage auf einmal.`,
    );
    expect(() => assertRange('2026-1-01', '2026-11-30')).toThrow(
      BadRequestException,
    );
  });

  it('converts card times both ways', () => {
    expect(minutesOfTime('20:00')).toBe(1200);
    expect(minutesOfTime('00:05')).toBe(5);
    expect(timeOfMinutes(1200)).toBe('20:00');
    expect(timeOfMinutes(5)).toBe('00:05');
    expect(timeOfMinutes(1439)).toBe('23:59');
  });
});

describe('Das Beste des Tages: the evening reminder', () => {
  const state = (change: Partial<ReminderState> = {}): ReminderState => ({
    cardMinutes: 20 * 60,
    reminderEnabled: true,
    remindedOn: null,
    hasEntry: false,
    ...change,
  });

  it('is due an hour after the card time on Berlin wall clock, summer and winter', () => {
    // CEST (UTC+2): 21:00 Berlin is 19:00 UTC.
    expect(reminderWindow('2026-07-01', 1200)).toEqual({
      dueAt: new Date('2026-07-01T19:00:00Z'),
      expiresAt: new Date('2026-07-01T20:00:00Z'),
    });
    // CET (UTC+1): 21:00 Berlin is 20:00 UTC.
    expect(reminderWindow('2026-11-23', 1200)).toEqual({
      dueAt: new Date('2026-11-23T20:00:00Z'),
      expiresAt: new Date('2026-11-23T21:00:00Z'),
    });
  });

  it('follows the clock on the days daylight saving changes', () => {
    // 29 March 2026: clocks jump from 02:00 to 03:00; evening is CEST.
    expect(reminderWindow('2026-03-29', 1200)?.dueAt).toEqual(
      new Date('2026-03-29T19:00:00Z'),
    );
    // A card at 01:30 asks for 02:30, which does not exist: 03:30 instead.
    expect(reminderWindow('2026-03-29', 90)?.dueAt).toEqual(
      new Date('2026-03-29T01:30:00Z'),
    );
    // 25 October 2026: clocks go back from 03:00 to 02:00; evening is CET.
    expect(reminderWindow('2026-10-25', 1200)?.dueAt).toEqual(
      new Date('2026-10-25T20:00:00Z'),
    );
  });

  it('never runs into the next day', () => {
    // Card at 22:30: due 23:30, its window ends at midnight, not 00:30.
    expect(reminderWindow('2026-11-23', 22 * 60 + 30)).toEqual({
      dueAt: new Date('2026-11-23T22:30:00Z'),
      expiresAt: new Date('2026-11-23T23:00:00Z'),
    });
    // From 23:00 on there is no hour left before midnight: no reminder.
    expect(reminderWindow('2026-11-23', 23 * 60)).toBeNull();
    expect(reminderWindow('2026-11-23', 1439)).toBeNull();
  });

  it('waits, sends once in its window, and is missed after it', () => {
    const at = (iso: string, change?: Partial<ReminderState>) =>
      reminderDecision(new Date(iso), state(change)).kind;
    expect(at('2026-11-23T19:59:59Z')).toBe('wait');
    expect(at('2026-11-23T20:00:00Z')).toBe('send');
    expect(at('2026-11-23T20:59:59Z')).toBe('send');
    expect(at('2026-11-23T21:00:00Z')).toBe('missed');
    // Handled today, switched off, or the day already has its line.
    expect(at('2026-11-23T20:10:00Z', { remindedOn: '2026-11-23' })).toBe(
      'none',
    );
    expect(at('2026-11-23T20:10:00Z', { reminderEnabled: false })).toBe('none');
    expect(at('2026-11-23T20:10:00Z', { hasEntry: true })).toBe('none');
    // Yesterday's reminder does not count for today.
    expect(at('2026-11-23T20:10:00Z', { remindedOn: '2026-11-22' })).toBe(
      'send',
    );
    expect(at('2026-11-23T20:10:00Z', { cardMinutes: 23 * 60 + 30 })).toBe(
      'none',
    );
  });

  it('names the Berlin day, also just after midnight UTC', () => {
    // 23:30 UTC on the 23rd is already the 24th in Berlin (00:30 CET);
    // a card at midnight is due at 01:00.
    const decision = reminderDecision(
      new Date('2026-11-23T23:30:00Z'),
      state({ cardMinutes: 0 }),
    );
    expect(decision).toEqual({ kind: 'wait', day: '2026-11-24' });
    const sent = reminderDecision(
      new Date('2026-11-24T00:10:00Z'),
      state({ cardMinutes: 0 }),
    );
    expect(sent).toEqual({
      kind: 'send',
      day: '2026-11-24',
      dueAt: new Date('2026-11-24T00:00:00Z'),
      expiresAt: new Date('2026-11-24T01:00:00Z'),
    });
  });
});
