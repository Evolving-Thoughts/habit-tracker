import { Weekday } from '../../habits/enums/weekday.enum';

export type DateRange = {
  startDate: string;
  endDate: string;
};

export class HabitScheduleCalculator {
  static getNextIntervalDate(options: {
    startDate: string;
    intervalDays: number;
    lastScheduledDate: string | null;
  }): string {
    if (options.lastScheduledDate === null) {
      return options.startDate;
    }

    return this.addDays(options.lastScheduledDate, options.intervalDays);
  }

  static isFixedWeekday(date: string, weekdays: Weekday[]): boolean {
    const weekday = this.getWeekday(date);

    return weekdays.includes(weekday);
  }

  static getWeekRange(date: string): DateRange {
    const parsedDate = this.parseDate(date);
    const dayOfWeek = parsedDate.getUTCDay();

    // JavaScript: Sonntag = 0, Montag = 1.
    // In unserer Anwendung beginnt die Woche am Montag.
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const monday = this.addDays(date, -daysSinceMonday);

    const sunday = this.addDays(monday, 6);

    return {
      startDate: monday,
      endDate: sunday,
    };
  }

  static addDays(date: string, numberOfDays: number): string {
    const parsedDate = this.parseDate(date);

    parsedDate.setUTCDate(parsedDate.getUTCDate() + numberOfDays);

    return this.formatDate(parsedDate);
  }

  static isOnOrBefore(firstDate: string, secondDate: string): boolean {
    return firstDate <= secondDate;
  }

  private static getWeekday(date: string): Weekday {
    const dayOfWeek = this.parseDate(date).getUTCDay();

    const weekdaysByNumber: Record<number, Weekday> = {
      0: Weekday.SUNDAY,
      1: Weekday.MONDAY,
      2: Weekday.TUESDAY,
      3: Weekday.WEDNESDAY,
      4: Weekday.THURSDAY,
      5: Weekday.FRIDAY,
      6: Weekday.SATURDAY,
    };

    const weekday = weekdaysByNumber[dayOfWeek];

    if (!weekday) {
      throw new Error(`Could not determine weekday for ${date}`);
    }

    return weekday;
  }

  private static parseDate(date: string): Date {
    const parsedDate = new Date(`${date}T00:00:00.000Z`);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }

    return parsedDate;
  }

  private static formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
