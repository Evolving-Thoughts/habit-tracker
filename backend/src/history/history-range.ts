import { BadRequestException } from '@nestjs/common';
import { assertDateOnly } from '../common/date/date-only.utils';
import { addDays, endOfDay, weekRange } from '../common/date/local-day';

export function historyRange(date: string, view: 'day' | 'week'): string[] {
  assertDateOnly(date);
  if (date < '1000-01-01')
    throw new BadRequestException('Date is outside the supported range');
  const start = view === 'week' ? weekRange(date).startDate : date;
  if (start < '1000-01-01')
    throw new BadRequestException('Date is outside the supported range');
  const dates = Array.from({ length: view === 'week' ? 7 : 1 }, (_, i) =>
    addDays(start, i),
  );
  // Also validate the exclusive upper boundary used by timestamp queries.
  endOfDay(dates[dates.length - 1]);
  return dates;
}
