import { BadRequestException } from '@nestjs/common';
import { Weekday } from '../../habits/enums/weekday.enum';
import {
  addDays,
  daysBetween,
  dayOf,
  endOfDay,
  startOfDay,
  weekRange,
  weekdayOf,
} from './local-day';

describe('local day', () => {
  it.each([
    ['2026-09-30', 1, '2026-10-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-10-01', -1, '2026-09-30'],
    ['2026-03-28', 1, '2026-03-29'],
  ])('adds days to %s (%i)', (date, days, expected) =>
    expect(addDays(date, days)).toBe(expected),
  );
  it('rejects results outside the four-digit calendar', () =>
    expect(() => addDays('9999-12-31', 1)).toThrow(BadRequestException));
  it('counts days across daylight-saving changes', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-26', '2026-10-24')).toBe(-2);
  });
  it.each([
    ['2026-09-21', Weekday.MONDAY],
    ['2026-09-22', Weekday.TUESDAY],
    ['2026-09-27', Weekday.SUNDAY],
  ])('knows the weekday of %s', (date, weekday) =>
    expect(weekdayOf(date)).toBe(weekday),
  );
  it.each(['2026-09-21', '2026-09-23', '2026-09-27'])(
    'uses a Monday–Sunday week for %s',
    (date) =>
      expect(weekRange(date)).toEqual({
        startDate: '2026-09-21',
        endDate: '2026-09-27',
      }),
  );
  it('clamps the last supported week', () =>
    expect(weekRange('9999-12-30').endDate).toBe('9999-12-31'));
  it('maps instants to Berlin days', () => {
    expect(dayOf(new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-02');
    expect(startOfDay('2026-03-29').toISOString()).toBe(
      '2026-03-28T23:00:00.000Z',
    );
    expect(endOfDay('2026-03-29').toISOString()).toBe(
      '2026-03-29T22:00:00.000Z',
    );
  });
});
