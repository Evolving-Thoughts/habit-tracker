import { Orderable, sortInDay } from './day-order';

const item = (
  id: number,
  dayPosition: number | null = null,
  timeOfDay: string | null = null,
  scheduledDate = '2026-11-17',
): Orderable => ({ id, dayPosition, timeOfDay, scheduledDate });
const order = (items: Orderable[]): number[] =>
  sortInDay(items, (entry) => entry).map(({ id }) => id);

describe('sortInDay', () => {
  it('follows the sorted positions', () => {
    expect(order([item(1, 2), item(2, 0), item(3, 1)])).toEqual([2, 3, 1]);
  });

  it('puts what was never sorted at the end, oldest first', () => {
    expect(order([item(9), item(4), item(1, 5), item(2, 0)])).toEqual([
      2, 1, 4, 9,
    ]);
  });

  it('puts appointments that were never sorted first, by clock', () => {
    expect(
      order([item(1, 0), item(2, null, '14:00'), item(3, null, '09:30')]),
    ).toEqual([3, 2, 1]);
  });

  it('keeps an item sorted between two appointments there', () => {
    expect(
      order([
        item(1, 0),
        item(2, 1, '10:00'),
        item(3, 2),
        item(4, 3, '14:30'),
        item(5, 4),
      ]),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps appointments on the clock among each other', () => {
    // The 14:30 one was stored before the 10:00 one: it moves down to it.
    expect(
      order([item(1, 0, '14:30'), item(2, 1), item(3, 2, '10:00'), item(4, 3)]),
    ).toEqual([2, 3, 1, 4]);
  });

  it('puts a new appointment right after the one before it on the clock', () => {
    expect(
      order([
        item(1, 0, '10:00'),
        item(2, 1),
        item(3, 2, '14:00'),
        item(4, 3),
        item(5, null, '18:00'),
      ]),
    ).toEqual([1, 2, 3, 5, 4]);
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

  it('asks the tie-breaker when place and id are equal', () => {
    const titled = [
      { title: 'b', ...item(0) },
      { title: 'a', ...item(0) },
    ];
    expect(
      sortInDay(
        titled,
        (entry) => entry,
        (first, second) => first.title.localeCompare(second.title),
      ).map(({ title }) => title),
    ).toEqual(['a', 'b']);
  });
});
