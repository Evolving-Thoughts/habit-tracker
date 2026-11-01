import { BadRequestException } from '@nestjs/common';
import { assertDateOnly } from '../common/date/date-only.utils';
import { addDays, endOfDay, weekRange } from '../common/date/local-day';

function monthDays(date: string): string[] {
  const first = `${date.slice(0, 7)}-01`;
  const dates: string[] = [];
  for (let day = first; day.slice(0, 7) === first.slice(0, 7);) {
    dates.push(day);
    day = addDays(day, 1);
  }
  return dates;
}

export function historyRange(
  date: string,
  view: 'day' | 'week' | 'month',
): string[] {
  assertDateOnly(date);
  if (date < '1000-01-01')
    throw new BadRequestException('Date is outside the supported range');
  if (view === 'month') {
    const dates = monthDays(date);
    endOfDay(dates[dates.length - 1]);
    return dates;
  }
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
