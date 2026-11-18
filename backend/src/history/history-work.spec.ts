import { DayLog, dayWork } from './history-work';

const DAY = '2026-11-17';
const writing = { id: 1, title: 'Buch' };
const garden = { id: 2, title: 'Garten' };
let nextId = 1;
const log = (
  from: string,
  to: string,
  campaign: DayLog['campaign'] = null,
): DayLog => ({
  id: nextId++,
  title: 'Arbeit',
  startedAt: new Date(from),
  endedAt: new Date(to),
  source: 'timer',
  todoId: 5,
  occurrenceId: null,
  habitId: null,
  campaign,
});

describe('dayWork', () => {
  it('gives the month only the minutes', () => {
    expect(
      dayWork(
        [log('2026-11-17T08:00:00Z', '2026-11-17T09:15:00Z')],
        DAY,
        false,
      ),
    ).toEqual({ minutes: 75 });
  });

  it('splits the day by campaign, largest first, no campaign last', () => {
    const work = dayWork(
      [
        log('2026-11-17T07:00:00Z', '2026-11-17T07:20:00Z'),
        log('2026-11-17T08:00:00Z', '2026-11-17T08:30:00Z', garden),
        log('2026-11-17T09:00:00Z', '2026-11-17T10:00:00Z', writing),
        // Overlaps the garden work: its time counts once, for the garden.
        log('2026-11-17T08:15:00Z', '2026-11-17T08:45:00Z', writing),
      ],
      DAY,
      true,
    );
    expect(work.minutes).toBe(125);
    expect(work.campaigns).toEqual([
      { campaign: writing, minutes: 75 },
      { campaign: garden, minutes: 30 },
      { campaign: null, minutes: 20 },
    ]);
    expect(work.logs).toHaveLength(4);
  });

  it('lists a stretch across midnight on both days at its full length', () => {
    const night = log('2026-11-16T22:30:00Z', '2026-11-16T23:30:00Z', writing);
    const before = dayWork([night], '2026-11-16', true);
    const after = dayWork([night], DAY, true);
    expect(before.minutes).toBe(30);
    expect(after.minutes).toBe(30);
    expect(after.logs).toEqual([
      expect.objectContaining({
        minutes: 60,
        startedAt: '2026-11-16T22:30:00.000Z',
        campaign: writing,
      }),
    ]);
    expect(dayWork([night], '2026-11-18', true)).toEqual({
      minutes: 0,
      campaigns: [],
      logs: [],
    });
  });
});
