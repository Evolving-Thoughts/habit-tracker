import { Weekday } from '../../habits/enums/weekday.enum';
import { HabitScheduleCalculator } from './habit-schedule-calculator';

describe('HabitScheduleCalculator', () => {
  describe('getNextIntervalDate', () => {
    it('uses the start date when no occurrence exists', () => {
      expect(
        HabitScheduleCalculator.getNextIntervalDate({
          startDate: '2026-09-21',
          intervalDays: 2,
          lastScheduledDate: null,
        }),
      ).toBe('2026-09-21');
    });

    it('calculates the next date from the last scheduled date', () => {
      expect(
        HabitScheduleCalculator.getNextIntervalDate({
          startDate: '2026-09-21',
          intervalDays: 2,
          lastScheduledDate: '2026-09-23',
        }),
      ).toBe('2026-09-25');
    });

    it('keeps the fixed rhythm based on scheduled dates', () => {
      const scheduledDate = '2026-09-23';

      // Selbst wenn diese Ausführung erst am
      // 24.09. erledigt wurde, bleibt scheduledDate
      // der Intervallanker.
      expect(
        HabitScheduleCalculator.getNextIntervalDate({
          startDate: '2026-09-21',
          intervalDays: 2,
          lastScheduledDate: scheduledDate,
        }),
      ).toBe('2026-09-25');
    });
  });

  describe('addDays', () => {
    it('adds days across a month boundary', () => {
      expect(HabitScheduleCalculator.addDays('2026-09-30', 1)).toBe(
        '2026-10-01',
      );
    });

    it('adds days across a year boundary', () => {
      expect(HabitScheduleCalculator.addDays('2026-12-31', 1)).toBe(
        '2027-01-01',
      );
    });

    it('handles leap years', () => {
      expect(HabitScheduleCalculator.addDays('2028-02-28', 1)).toBe(
        '2028-02-29',
      );
    });

    it('subtracts days', () => {
      expect(HabitScheduleCalculator.addDays('2026-10-01', -1)).toBe(
        '2026-09-30',
      );
    });
  });

  describe('isFixedWeekday', () => {
    it('returns true for an included weekday', () => {
      expect(
        HabitScheduleCalculator.isFixedWeekday('2026-09-21', [
          Weekday.MONDAY,
          Weekday.THURSDAY,
        ]),
      ).toBe(true);
    });

    it('returns false for a weekday that is not included', () => {
      expect(
        HabitScheduleCalculator.isFixedWeekday('2026-09-22', [
          Weekday.MONDAY,
          Weekday.THURSDAY,
        ]),
      ).toBe(false);
    });

    it('recognizes Sunday correctly', () => {
      expect(
        HabitScheduleCalculator.isFixedWeekday('2026-09-27', [Weekday.SUNDAY]),
      ).toBe(true);
    });
  });

  describe('getWeekRange', () => {
    it('returns Monday through Sunday for a weekday', () => {
      expect(HabitScheduleCalculator.getWeekRange('2026-09-23')).toEqual({
        startDate: '2026-09-21',
        endDate: '2026-09-27',
      });
    });

    it('returns the same Monday when given Monday', () => {
      expect(HabitScheduleCalculator.getWeekRange('2026-09-21')).toEqual({
        startDate: '2026-09-21',
        endDate: '2026-09-27',
      });
    });

    it('returns the preceding Monday when given Sunday', () => {
      expect(HabitScheduleCalculator.getWeekRange('2026-09-27')).toEqual({
        startDate: '2026-09-21',
        endDate: '2026-09-27',
      });
    });
  });

  describe('isOnOrBefore', () => {
    it('returns true for the same date', () => {
      expect(
        HabitScheduleCalculator.isOnOrBefore('2026-09-21', '2026-09-21'),
      ).toBe(true);
    });

    it('returns true for an earlier date', () => {
      expect(
        HabitScheduleCalculator.isOnOrBefore('2026-09-20', '2026-09-21'),
      ).toBe(true);
    });

    it('returns false for a later date', () => {
      expect(
        HabitScheduleCalculator.isOnOrBefore('2026-09-22', '2026-09-21'),
      ).toBe(false);
    });
  });
});
