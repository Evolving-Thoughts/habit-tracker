import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Clock } from '../common/clock';
import { assertDateOnly } from '../common/date/date-only.utils';
import { saveDayText } from '../common/day-text';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import type {
  DayBestMonthsResponse,
  DayBestRangeResponse,
  DayBestResponse,
  DayBestSettingsResponse,
} from './day-best.dto';
import {
  DayBestEntity,
  DayBestSettingsEntity,
  DEFAULT_CARD_MINUTES,
} from './day-best.entities';
import {
  assertRange,
  FUTURE_DAY_MESSAGE,
  minutesOfTime,
  normalizeDayBestText,
  timeOfMinutes,
} from './day-best-rules';

/** The lines of "Das Beste des Tages" and the settings around them. */
@Injectable()
export class DayBestsService {
  constructor(
    @InjectRepository(DayBestEntity)
    private readonly entries: Repository<DayBestEntity>,
    @InjectRepository(DayBestSettingsEntity)
    private readonly settingsRows: Repository<DayBestSettingsEntity>,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  /** One day; a day without a line reads as empty. */
  async find(userId: string, date: string): Promise<DayBestResponse> {
    assertDateOnly(date);
    const found = await this.entries.findOneBy({ userId, date });
    return { date, text: found?.text ?? '' };
  }

  /** The lines from `from` to `to`, both included, newest first. */
  async range(
    userId: string,
    from: string,
    to: string,
  ): Promise<DayBestRangeResponse> {
    assertRange(from, to);
    const rows = await this.entries.find({
      where: { userId, date: Between(from, to) },
      order: { date: 'DESC' },
    });
    return { entries: rows.map(({ date, text }) => ({ date, text })) };
  }

  /** How many lines each month holds, newest month first. */
  async months(userId: string): Promise<DayBestMonthsResponse> {
    const rows = await this.entries.query<{ month: string; count: number }[]>(
      `SELECT to_char(b.date, 'YYYY-MM') AS month, COUNT(*)::int AS count
       FROM day_bests b
       WHERE b."userId" = $1
       GROUP BY 1
       ORDER BY 1 DESC`,
      [userId],
    );
    return {
      today: this.clock.today(),
      months: rows.map(({ month, count }) => ({ month, count: Number(count) })),
    };
  }

  /**
   * One line per day (`saveDayText`): saving replaces it, an empty line
   * removes it, a day after today takes none.
   */
  save(
    userId: string,
    date: string,
    rawText: string,
  ): Promise<DayBestResponse> {
    return saveDayText(this.unitOfWork, DayBestEntity, {
      userId,
      date,
      text: normalizeDayBestText(rawText),
      today: this.clock.today(),
      futureMessage: FUTURE_DAY_MESSAGE,
    });
  }

  /** Removes the day's line; a day without one stays as it is. */
  async remove(userId: string, date: string): Promise<void> {
    assertDateOnly(date);
    await this.unitOfWork.run(userId, (manager) =>
      manager.getRepository(DayBestEntity).delete({ userId, date }),
    );
  }

  settings(userId: string): Promise<DayBestSettingsResponse> {
    return this.settingsOf(this.settingsRows, userId);
  }

  /**
   * Changes what is given; the rest keeps its stored or default value. Read
   * and write happen under the user lock, so two changes at once do not
   * undo each other.
   */
  saveSettings(
    userId: string,
    change: { cardTime?: string; reminderEnabled?: boolean },
  ): Promise<DayBestSettingsResponse> {
    return this.unitOfWork.run(userId, async (manager) => {
      const rows = manager.getRepository(DayBestSettingsEntity);
      const current = await this.settingsOf(rows, userId);
      const cardTime = change.cardTime ?? current.cardTime;
      const reminderEnabled = change.reminderEnabled ?? current.reminderEnabled;
      await rows.upsert(
        { userId, cardMinutes: minutesOfTime(cardTime), reminderEnabled },
        ['userId'],
      );
      return { cardTime, reminderEnabled };
    });
  }

  private async settingsOf(
    rows: Repository<DayBestSettingsEntity>,
    userId: string,
  ): Promise<DayBestSettingsResponse> {
    const row = await rows.findOneBy({ userId });
    return {
      cardTime: timeOfMinutes(row?.cardMinutes ?? DEFAULT_CARD_MINUTES),
      reminderEnabled: row?.reminderEnabled ?? true,
    };
  }
}
