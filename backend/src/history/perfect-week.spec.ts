import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { perfectWeek, perfectWeekOf } from './perfect-week';

const sport = { id: 1, name: 'Sport', weeklyTarget: 2 };
const music = { id: 2, name: 'Musik', weeklyTarget: 1 };
const free = { id: 3, name: 'Frei', weeklyTarget: null };

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
        { id: 1, name: 'Sport', target: 2, completed: 1, reached: false },
        { id: 2, name: 'Musik', target: 1, completed: 1, reached: true },
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
        { id: 1, name: 'Sport', target: 2, completed: 2, reached: true },
        { id: 2, name: 'Musik', target: 1, completed: 0, reached: false },
      ],
    });
  });
});
