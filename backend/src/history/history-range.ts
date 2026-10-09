import { BadRequestException } from '@nestjs/common';
import { assertDateOnly } from '../common/date/date-only.utils';
export function addHistoryDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  const result = value.toISOString().slice(0, 10);
  assertDateOnly(result);
  return result;
}
export function historyRange(date: string, view: 'day' | 'week'): string[] {
  assertDateOnly(date);
  if (date < '1000-01-01')
    throw new BadRequestException('Date is outside the supported range');
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const start =
    view === 'week' ? addHistoryDays(date, -((weekday + 6) % 7)) : date;
  const dates = Array.from({ length: view === 'week' ? 7 : 1 }, (_, i) =>
    addHistoryDays(start, i),
  );
  // Also validate the exclusive upper boundary used by timestamp queries.
  addHistoryDays(dates[dates.length - 1], 1);
  if (start < '1000-01-01')
    throw new BadRequestException('Date is outside the supported range');
  return dates;
}
