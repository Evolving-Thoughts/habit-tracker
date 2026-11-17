import {
  coverage,
  coveredMilliseconds,
  onDay,
  workedMinutes,
  workedMinutesBy,
} from './work-time';

const at = (minute: number): Date => new Date(minute * 60_000);
const span = (from: number, to: number) => ({
  startedAt: at(from),
  endedAt: at(to),
});
const berlin = (from: string, to: string, key = '') => ({
  startedAt: new Date(from),
  endedAt: new Date(to),
  key,
});

describe('coveredMilliseconds', () => {
  it.each([
    ['nothing', [], 0],
    ['separate stretches', [span(0, 10), span(20, 30)], 20],
    ['partial overlap', [span(0, 10), span(5, 15)], 15],
    ['a nested stretch', [span(0, 30), span(10, 20)], 30],
    ['unsorted input', [span(20, 30), span(0, 25)], 30],
  ])('handles %s', (_name, intervals, minutes) => {
    expect(coveredMilliseconds(intervals)).toBe(minutes * 60_000);
  });
});

describe('coverage', () => {
  it('gives overlapping time to the stretch that started first', () => {
    const first = span(0, 20);
    const nested = span(5, 10);
    const later = span(15, 30);
    const shares = coverage([later, nested, first]);
    expect(shares.get(first)).toBe(20 * 60_000);
    expect(shares.get(nested)).toBe(0);
    expect(shares.get(later)).toBe(10 * 60_000);
  });
});

describe('a day of work in Berlin', () => {
  it('splits a stretch across midnight onto both days', () => {
    // 23:30 to 00:45 Berlin time (CET).
    const night = berlin('2026-11-16T22:30:00Z', '2026-11-16T23:45:00Z');
    expect(workedMinutes([night], '2026-11-16')).toBe(30);
    expect(workedMinutes([night], '2026-11-17')).toBe(45);
    expect(onDay([night], '2026-11-17')[0].startedAt.toISOString()).toBe(
      '2026-11-16T23:00:00.000Z',
    );
    expect(onDay([night], '2026-11-18')).toEqual([]);
  });

  it.each([
    // The spring day has 23 hours, the autumn day 25.
    ['2026-03-29', '2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z', 23 * 60],
    ['2026-10-25', '2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z', 25 * 60],
  ])(
    'counts the whole of %s across the clock change',
    (date, from, to, minutes) => {
      const allDay = berlin('2026-01-01T00:00:00Z', '2026-12-31T00:00:00Z');
      expect(workedMinutes([allDay], date)).toBe(minutes);
      expect(workedMinutes([berlin(from, to)], date)).toBe(minutes);
    },
  );

  it('counts overlaps once', () => {
    expect(
      workedMinutes(
        [
          berlin('2026-11-17T08:00:00Z', '2026-11-17T09:00:00Z'),
          berlin('2026-11-17T08:30:00Z', '2026-11-17T09:30:00Z'),
        ],
        '2026-11-17',
      ),
    ).toBe(90);
  });

  it('splits by key into parts that add up to the day', () => {
    const logs = [
      berlin('2026-11-17T08:00:00.000Z', '2026-11-17T08:00:20.000Z', 'a'),
      berlin('2026-11-17T09:00:00.000Z', '2026-11-17T09:00:20.000Z', 'b'),
      berlin('2026-11-17T10:00:00.000Z', '2026-11-17T10:00:20.000Z', 'a'),
      berlin('2026-11-17T10:00:10.000Z', '2026-11-17T10:30:00.000Z', 'c'),
    ];
    const parts = workedMinutesBy(logs, '2026-11-17', (log) => log.key);
    const total = [...parts.values()].reduce((sum, part) => sum + part, 0);
    expect(total).toBe(workedMinutes(logs, '2026-11-17'));
    expect(parts.get('c')).toBe(30);
  });
});
