import {
  assertDateOnly,
  changeScheduleInstant,
  getCurrentDateInTimeZone,
  initialScheduleInstant,
  midnightInTimeZone,
} from './date-only.utils';

describe('date-only utilities', () => {
  it('uses the Berlin calendar date', () => {
    expect(
      getCurrentDateInTimeZone(
        'Europe/Berlin',
        new Date('2026-10-01T22:30:00Z'),
      ),
    ).toBe('2026-10-02');
  });

  it('calculates midnight before the daylight-saving change', () => {
    expect(midnightInTimeZone('2026-03-29').toISOString()).toBe(
      '2026-03-28T23:00:00.000Z',
    );
  });

  it('calculates midnight after the daylight-saving change', () => {
    expect(midnightInTimeZone('2026-03-30').toISOString()).toBe(
      '2026-03-29T22:00:00.000Z',
    );
  });

  it('activates a change for today immediately', () => {
    const now = new Date('2026-10-02T12:00:00Z');

    expect(changeScheduleInstant('2026-10-02', now)).toEqual(now);
  });

  it('activates a future change at Berlin midnight', () => {
    expect(
      changeScheduleInstant(
        '2026-10-03',
        new Date('2026-10-02T12:00:00Z'),
      ).toISOString(),
    ).toBe('2026-10-02T22:00:00.000Z');
  });

  it('rejects retroactive changes', () => {
    expect(() =>
      changeScheduleInstant('2026-10-01', new Date('2026-10-02T12:00:00Z')),
    ).toThrow();
  });

  it('allows a historical initial start date', () => {
    expect(
      initialScheduleInstant(
        '2026-10-01',
        new Date('2026-10-02T12:00:00Z'),
      ).toISOString(),
    ).toBe('2026-09-30T22:00:00.000Z');
  });

  it.each(['02.10.2026', '2026-02-30', '2026-13-01', '2026-10-02T12:00:00Z'])(
    'rejects invalid date %s',
    (date) => {
      expect(() => assertDateOnly(date)).toThrow();
    },
  );
});
