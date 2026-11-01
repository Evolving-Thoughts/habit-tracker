import { replanDay, ReplanTodo } from './day-replan';

const MIN = 60_000;
const at = (hour: number, minute = 0): number =>
  Date.UTC(2026, 9, 30, hour, minute);
const todo = (
  id: number,
  start: number,
  minutes: number | null,
  extra: Partial<ReplanTodo> = {},
): ReplanTodo => ({
  id,
  title: `Todo ${id}`,
  start,
  minutes,
  isFixed: false,
  locked: false,
  ...extra,
});
const fixed = (id: number, start: number, minutes: number) =>
  todo(id, start, minutes, { isFixed: true });
const plan = (todos: ReplanTodo[], now = at(8), end = at(22)) =>
  replanDay(todos, now, end);

describe('replanDay', () => {
  it('leaves a day without collisions alone', () => {
    expect(plan([todo(1, at(9), 30), fixed(2, at(10), 60)])).toEqual([]);
  });

  it('splits when ten or more minutes fit before a fixed todo', () => {
    const [change] = plan([todo(1, at(9, 50), 40), fixed(2, at(10), 60)]);
    expect(change.pieces).toEqual([
      { start: at(9, 50), minutes: 10 },
      { start: at(11), minutes: 30 },
    ]);
  });

  it('moves completely when less than ten minutes fit', () => {
    const [change] = plan([todo(1, at(9, 51), 40), fixed(2, at(10), 60)]);
    expect(change.pieces).toEqual([{ start: at(11), minutes: 40 }]);
  });

  it('chains later flexible todos and keeps fixed ones', () => {
    const changes = plan([
      todo(1, at(9, 55), 30),
      fixed(2, at(10), 60),
      todo(3, at(11, 15), 30),
    ]);
    expect(changes.map((item) => item.todoId)).toEqual([1, 3]);
    expect(changes[1].pieces).toEqual([{ start: at(11, 30), minutes: 30 }]);
  });

  it('never loses planned minutes across several fixed todos', () => {
    const [change] = plan([
      todo(1, at(9), 120),
      fixed(2, at(9, 30), 30),
      fixed(3, at(10, 30), 30),
    ]);
    expect(change.pieces.reduce((sum, item) => sum + item.minutes, 0)).toBe(
      120,
    );
    expect(change.tomorrowMinutes).toBe(0);
  });

  it('plans around busy times that are not todos', () => {
    const [change] = replanDay([todo(1, at(9), 60)], at(8), at(22), [
      { start: at(9, 30), end: at(10, 30) },
    ]);
    expect(change.pieces).toEqual([
      { start: at(9), minutes: 30 },
      { start: at(10, 30), minutes: 30 },
    ]);
  });

  it('starts late work from now', () => {
    const [change] = plan([todo(1, at(8), 30)], at(9));
    expect(change.pieces).toEqual([{ start: at(9), minutes: 30 }]);
  });

  it('leaves what does not fit before the day end for tomorrow', () => {
    const [change] = plan([todo(1, at(21), 90)], at(8));
    expect(change).toMatchObject({ pieces: [], tomorrowMinutes: 90 });

    const [split] = plan([todo(1, at(20), 90), fixed(2, at(21), 90)]);
    expect(split.pieces).toEqual([{ start: at(20), minutes: 60 }]);
    expect(split.tomorrowMinutes).toBe(30);
  });

  it('keeps todos without duration and locked ones in place', () => {
    const changes = plan([
      todo(1, at(9), null),
      todo(2, at(9), 60, { locked: true }),
      todo(3, at(9, 30), 30),
    ]);
    expect(changes.map((item) => item.todoId)).toEqual([3]);
    expect(changes[0].pieces[0].start).toBe(at(9) + 60 * MIN);
  });
});
