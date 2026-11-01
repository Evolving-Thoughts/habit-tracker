import { EntityManager, FindOptionsWhere, LessThan, MoreThan } from 'typeorm';
import { endOfDay, startOfDay } from '../common/date/local-day';
import { ExternalEventEntity } from './calendar.entities';

/**
 * Calendar events that occupy part of these days. An event reaching over
 * midnight counts on both days; one starting at the next midnight does not.
 */
export function eventsOfDays(
  manager: EntityManager,
  where: FindOptionsWhere<ExternalEventEntity>,
  firstDay: string,
  lastDay: string = firstDay,
): Promise<ExternalEventEntity[]> {
  return manager.find(ExternalEventEntity, {
    where: {
      ...where,
      start: LessThan(endOfDay(lastDay)),
      end: MoreThan(startOfDay(firstDay)),
    },
    order: { start: 'ASC' },
  });
}
