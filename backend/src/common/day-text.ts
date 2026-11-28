import { BadRequestException } from '@nestjs/common';
import type { EntityTarget } from 'typeorm';
import { assertDateOnly } from './date/date-only.utils';
import type { UserUnitOfWork } from './user-unit-of-work';

/** A row that holds one text of a user for one day. */
type DayTextRow = { userId: string; date: string; text: string };

/**
 * Whether `date` takes a text: a real day, today or before; a later day
 * answers 400 with `futureMessage`.
 */
export function assertDayTakesText(
  date: string,
  today: string,
  futureMessage: string,
): void {
  assertDateOnly(date);
  if (date > today) throw new BadRequestException(futureMessage);
}

/**
 * One text per user and day (a reflection, the day's best): saving
 * replaces it, an empty text removes it, and a day after `today` takes
 * none (`assertDayTakesText`). `text` comes as it is to be stored. The
 * write runs in the user's unit of work, like every change.
 */
export async function saveDayText(
  unitOfWork: UserUnitOfWork,
  target: EntityTarget<DayTextRow>,
  change: {
    userId: string;
    date: string;
    text: string;
    today: string;
    futureMessage: string;
  },
): Promise<{ date: string; text: string }> {
  const { userId, date, text, today, futureMessage } = change;
  assertDayTakesText(date, today, futureMessage);
  await unitOfWork.run(userId, async (manager) => {
    const rows = manager.getRepository(target);
    if (text) await rows.upsert({ userId, date, text }, ['userId', 'date']);
    else await rows.delete({ userId, date });
  });
  return { date, text };
}
