import { addDays } from '../common/date/local-day';
import type { Campaign } from '../todos/todo-ancestry';
import { TodoAncestry } from '../todos/todo-ancestry';
import { workedMinutes } from '../work-logs/work-time';
import {
  QuestInterval,
  questSoFar,
  questTimeByDay,
  questTimeOfDay,
  questWeek,
} from './quest-time';

const book: Campaign = { id: 1, title: 'Buch', color: 'berry', icon: 'book' };
const garden: Campaign = { id: 2, title: 'Garten', color: null, icon: null };

const log = (
  from: string,
  to: string,
  campaign: Campaign | null = null,
): QuestInterval => ({
  startedAt: new Date(from),
  endedAt: new Date(to),
  campaign,
});

const MONDAY = '2026-11-16';

describe('questTimeOfDay', () => {
  it('counts time on a campaign as quest time and the rest as other', () => {
    const day = questTimeOfDay(
      [
        log('2026-11-17T08:00:00Z', '2026-11-17T09:00:00Z', book),
        log('2026-11-17T10:00:00Z', '2026-11-17T10:20:00Z'),
      ],
      '2026-11-17',
    );
    expect(day.questMinutes).toBe(60);
    expect(day.otherMinutes).toBe(20);
    expect([...day.byCampaign]).toEqual([[1, 60]]);
  });

  it('counts overlapping time once, for the stretch that started first', () => {
    const day = questTimeOfDay(
      [
        log('2026-11-17T08:00:00Z', '2026-11-17T09:00:00Z', book),
        // Fully inside the book stretch: adds nothing.
        log('2026-11-17T08:15:00Z', '2026-11-17T08:45:00Z', garden),
        // Half inside: only its own half counts, and as other time.
        log('2026-11-17T08:30:00Z', '2026-11-17T09:30:00Z'),
      ],
      '2026-11-17',
    );
    expect(day).toEqual({
      questMinutes: 60,
      otherMinutes: 30,
      byCampaign: new Map([
        [1, 60],
        [2, 0],
      ]),
    });
  });

  it('gives a daily the campaign of the goal counting it', () => {
    // A daily's run only knows its habit; the goal names the campaign.
    const ancestry = new TodoAncestry(
      [
        {
          id: 1,
          parentId: null,
          why: null,
          title: 'Buch',
          goalHabitId: null,
          periodStart: null,
          periodEnd: null,
          weeklyTargetMinutes: null,
          color: 'berry',
          icon: 'book',
        },
        {
          id: 5,
          parentId: 1,
          why: null,
          title: 'Jeden Tag schreiben',
          goalHabitId: 7,
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
          weeklyTargetMinutes: null,
          color: null,
          icon: null,
        },
      ],
      '2026-11-17',
    );
    const run = log(
      '2026-11-17T06:00:00Z',
      '2026-11-17T06:45:00Z',
      ancestry.habitCampaign(7),
    );
    expect(questTimeOfDay([run], '2026-11-17').byCampaign.get(1)).toBe(45);
  });
});

describe('questTimeByDay', () => {
  it('cuts a stretch across Berlin midnight onto both days', () => {
    // 23:30 to 00:45 Berlin time (CET).
    const byDay = questTimeByDay([
      log('2026-11-16T22:30:00Z', '2026-11-16T23:45:00Z', book),
    ]);
    expect(byDay.get('2026-11-16')?.questMinutes).toBe(30);
    expect(byDay.get('2026-11-17')?.questMinutes).toBe(45);
    expect(byDay.size).toBe(2);
  });

  it.each([
    // The spring day has 23 hours, the autumn day 25.
    ['2026-03-29', '2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z', 23 * 60],
    ['2026-10-25', '2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z', 25 * 60],
  ])('counts the whole day %s as it is', (date, from, to, minutes) => {
    const byDay = questTimeByDay([log(from, to, book)]);
    expect([...byDay.keys()]).toEqual([date]);
    expect(byDay.get(date)?.questMinutes).toBe(minutes);
  });

  it('keeps every part adding up to the worked minutes of its day', () => {
    // A tangle of overlapping stretches with and without campaigns.
    const campaigns = [book, garden, null];
    const logs: QuestInterval[] = Array.from({ length: 40 }, (_, index) => {
      const start = Date.parse('2026-11-16T20:00:00Z') + index * 37 * 60_000;
      return {
        startedAt: new Date(start + (index % 3) * 13_000),
        endedAt: new Date(start + (25 + ((index * 17) % 90)) * 60_000 + 7_000),
        campaign: campaigns[index % 3],
      };
    });
    const byDay = questTimeByDay(logs);
    expect(byDay.size).toBeGreaterThan(1);
    for (const [date, time] of byDay) {
      const parts = [...time.byCampaign.values()].reduce((a, b) => a + b, 0);
      expect(parts).toBe(time.questMinutes);
      expect(time.questMinutes + time.otherMinutes).toBe(
        workedMinutes(logs, date),
      );
    }
  });
});

describe('questWeek', () => {
  it('answers seven days, the totals, the goals and the trend', () => {
    const week = questWeek(
      [
        log('2026-11-16T08:00:00Z', '2026-11-16T09:30:00Z', book),
        log('2026-11-18T08:00:00Z', '2026-11-18T08:40:00Z', garden),
        log('2026-11-18T10:00:00Z', '2026-11-18T10:15:00Z'),
        // The week before and long before the trend: totals only.
        log('2026-11-10T08:00:00Z', '2026-11-10T09:00:00Z', book),
        log('2025-01-07T08:00:00Z', '2025-01-07T08:30:00Z', book),
      ],
      MONDAY,
      [{ campaign: garden, minutes: 120 }],
    );
    expect(week).toMatchObject({
      startDate: MONDAY,
      endDate: '2026-11-22',
      questMinutes: 130,
      otherMinutes: 15,
    });
    expect(week.days.map(({ date }) => date)).toEqual(
      Array.from({ length: 7 }, (_, index) => addDays(MONDAY, index)),
    );
    expect(week.days[0]).toEqual({
      date: MONDAY,
      questMinutes: 90,
      otherMinutes: 0,
    });
    expect(week.days[2]).toEqual({
      date: '2026-11-18',
      questMinutes: 40,
      otherMinutes: 15,
    });
    expect(week.weeks).toHaveLength(8);
    expect(week.weeks[0].startDate).toBe('2026-09-28');
    expect(week.weeks.slice(-2)).toEqual([
      { startDate: '2026-11-09', questMinutes: 60 },
      { startDate: MONDAY, questMinutes: 130 },
    ]);
    expect(week.campaigns).toEqual([
      {
        campaign: book,
        minutes: 90,
        weeklyTargetMinutes: null,
        weeks: [0, 0, 0, 0, 0, 0, 60, 90],
        totalMinutes: 180,
      },
      {
        campaign: garden,
        minutes: 40,
        weeklyTargetMinutes: 120,
        weeks: [0, 0, 0, 0, 0, 0, 0, 40],
        totalMinutes: 40,
      },
    ]);
  });

  it('lists a campaign with a goal but no time, and none without either', () => {
    const week = questWeek(
      [log('2026-11-17T08:00:00Z', '2026-11-17T08:30:00Z')],
      MONDAY,
      [{ campaign: book, minutes: 300 }],
    );
    expect(week.campaigns).toEqual([
      {
        campaign: book,
        minutes: 0,
        weeklyTargetMinutes: 300,
        weeks: [0, 0, 0, 0, 0, 0, 0, 0],
        totalMinutes: 0,
      },
    ]);
    expect(week.questMinutes).toBe(0);
    expect(week.otherMinutes).toBe(30);
  });

  it('cuts a stretch across the week boundary at Berlin midnight', () => {
    // Sunday 23:00 to Monday 01:00 Berlin time (CET).
    const night = log('2026-11-22T22:00:00Z', '2026-11-23T00:00:00Z', book);
    const first = questWeek([night], MONDAY, []);
    const second = questWeek([night], '2026-11-23', []);
    expect(first.questMinutes).toBe(60);
    expect(second.questMinutes).toBe(60);
    expect(second.weeks.slice(-2).map((week) => week.questMinutes)).toEqual([
      60, 60,
    ]);
    expect(second.campaigns[0].totalMinutes).toBe(120);
  });

  it.each([
    // Berlin midnights around the spring change (CET to CEST) ...
    ['2026-03-23', '2026-03-22T23:00:00Z', '2026-03-29T22:00:00Z', -60],
    // ... and around the autumn change (CEST to CET), both on a Sunday.
    ['2026-10-19', '2026-10-18T22:00:00Z', '2026-10-25T23:00:00Z', 60],
  ])('counts the week from %s by its real hours', (monday, from, to, shift) => {
    const hour = 3_600_000;
    // An hour more on each side, which belongs to the neighbouring weeks.
    const stretch = log(
      new Date(Date.parse(from) - hour).toISOString(),
      new Date(Date.parse(to) + hour).toISOString(),
      book,
    );
    const week = questWeek([stretch], monday, []);
    expect(week.questMinutes).toBe(7 * 24 * 60 + shift);
    expect(week.campaigns[0].totalMinutes).toBe(7 * 24 * 60 + shift + 120);
  });
});

describe('questSoFar', () => {
  it('answers the quest minutes of today and of its whole week', () => {
    const logs = [
      log('2026-11-16T08:00:00Z', '2026-11-16T09:00:00Z', book),
      log('2026-11-18T08:00:00Z', '2026-11-18T08:20:00Z', garden),
      log('2026-11-18T09:00:00Z', '2026-11-18T09:30:00Z'),
      log('2026-11-12T08:00:00Z', '2026-11-12T09:00:00Z', book),
    ];
    expect(questSoFar(logs, '2026-11-18')).toEqual({
      todayMinutes: 20,
      weekMinutes: 80,
    });
  });
});
