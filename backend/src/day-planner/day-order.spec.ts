import { compareInDay, Orderable } from './day-order';

const item = (
  id: number,
  dayPosition: number | null = null,
  timeOfDay: string | null = null,
  scheduledDate = '2026-11-17',
): Orderable => ({ id, dayPosition, timeOfDay, scheduledDate });
const order = (items: Orderable[]): number[] =>
  [...items].sort(compareInDay).map(({ id }) => id);

describe('compareInDay', () => {
  it('follows the sorted positions', () => {
    expect(order([item(1, 2), item(2, 0), item(3, 1)])).toEqual([2, 3, 1]);
  });

  it('puts what was never sorted at the end, oldest first', () => {
    expect(order([item(9), item(4), item(1, 5), item(2, 0)])).toEqual([
      2, 1, 4, 9,
    ]);
  });

  it('keeps appointments on the clock, before the open order', () => {
    expect(
      order([item(1, 0), item(2, null, '14:00'), item(3, 7, '09:30')]),
    ).toEqual([3, 2, 1]);
  });

  it('separates days before anything else', () => {
    expect(
      order([
        item(1, 0),
        item(2, 9, null, '2026-11-16'),
        item(3, null, '08:00'),
      ]),
    ).toEqual([2, 3, 1]);
  });

  it('is stable for equal times and equal positions', () => {
    expect(order([item(5, null, '10:00'), item(2, null, '10:00')])).toEqual([
      2, 5,
    ]);
    expect(order([item(5, 1), item(2, 1)])).toEqual([2, 5]);
  });
});
