import { BadRequestException } from '@nestjs/common';
import { historyRange } from './history-range';
describe('historyRange', () => {
  it('returns a single day', () =>
    expect(historyRange('2026-10-07', 'day')).toEqual(['2026-10-07']));
  it.each(['2026-10-05', '2026-10-07', '2026-10-11'])(
    'starts the week on Monday for %s',
    (date) => {
      expect(historyRange(date, 'week')).toEqual([
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
        '2026-10-11',
      ]);
    },
  );
  it('crosses the year boundary', () =>
    expect(historyRange('2027-01-01', 'week')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]));
  it('does not shift dates at DST', () =>
    expect(historyRange('2026-03-29', 'week')[6]).toBe('2026-03-29'));
  it.each([
    '',
    '07.10.2026',
    '2026-02-30',
    '2026-2-01',
    '2026-10-07T00:00:00Z',
    '0000-01-01',
    '9999-12-31',
  ])('rejects unsupported date %s', (date) =>
    expect(() => historyRange(date, 'day')).toThrow(BadRequestException),
  );
  it('rejects a week whose exclusive boundary is out of range', () =>
    expect(() => historyRange('9999-12-30', 'week')).toThrow(
      BadRequestException,
    ));
});
