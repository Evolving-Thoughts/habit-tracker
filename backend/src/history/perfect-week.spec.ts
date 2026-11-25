import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { perfectWeek, perfectWeekOf } from './perfect-week';

const sport = { id: 1, name: 'Sport', color: 'navy' as const, weeklyTarget: 2 };
const music = { id: 2, name: 'Musik', color: null, weeklyTarget: 1 };
const free = { id: 3, name: 'Frei', color: null, weeklyTarget: null };

describe('perfectWeek', () => {
  it('ignores categories without a target', () => {
    expect(perfectWeek([free], [3, 3])).toBeNull();
  });

  it('is perfect when every target is reached', () => {
    expect(perfectWeek([sport, music, free], [1, 1, 2, null])?.perfect).toBe(
      true,
    );
  });

  it('reports what is still missing', () => {
    expect(perfectWeek([sport, music], [1, 2])).toEqual({
      perfect: false,
      categories: [
        {
          id: 1,
          name: 'Sport',
          color: 'navy',
          target: 2,
          completed: 1,
          reached: false,
        },
        {
          id: 2,
          name: 'Musik',
          color: 'teal', // shown, not stored: the colour its name picks
          target: 1,
          completed: 1,
          reached: true,
        },
      ],
    });
  });
});

describe('perfectWeekOf', () => {
  it('counts completed quests and runs by category, not skipped runs', () => {
    const run = (status: HabitOccurrenceStatus, categoryId: number | null) => ({
      status,
      habit: { categoryId },
    });
    expect(
      perfectWeekOf(
        [sport, music],
        [{ categoryId: 1 }, { categoryId: null }],
        [
          run(HabitOccurrenceStatus.COMPLETED, 1),
          run(HabitOccurrenceStatus.SKIPPED, 2),
        ],
      ),
    ).toEqual({
      perfect: false,
      categories: [
        {
          id: 1,
          name: 'Sport',
          color: 'navy',
          target: 2,
          completed: 2,
          reached: true,
        },
        {
          id: 2,
          name: 'Musik',
          color: 'teal',
          target: 1,
          completed: 0,
          reached: false,
        },
      ],
    });
  });
});
