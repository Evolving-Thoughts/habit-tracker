import { DataSource, EntityManager } from 'typeorm';
import { Clock } from '../../common/clock';
import { UserUnitOfWork } from '../../common/user-unit-of-work';
import { HabitSchedulingService } from './habit-scheduling.service';

describe('HabitSchedulingService.answerAsOfNow', () => {
  const BEFORE = new Date('2026-11-28T08:00:00.000Z');
  /** The moment once a change in progress has let go of the lock. */
  const AFTER_LOCK = new Date('2026-11-28T08:00:05.000Z');
  // No active habits: nothing to load, nothing to store.
  const noHabits = () =>
    ({
      getRepository: () => ({ find: () => Promise.resolve([]) }),
    }) as unknown as EntityManager;
  const snapshot = noHabits();
  const locked = noHabits();
  let now: Date;
  let run: jest.Mock;
  let service: HabitSchedulingService;

  beforeEach(() => {
    now = BEFORE;
    run = jest.fn(
      (_userId: string, work: (manager: EntityManager) => unknown) => {
        // Entering `run` means the lock was granted, a little later.
        now = AFTER_LOCK;
        return work(locked);
      },
    );
    service = new HabitSchedulingService(
      {} as DataSource,
      { now: () => now } as Clock,
      {
        read: (work: (manager: EntityManager) => unknown) => work(snapshot),
        run,
      } as unknown as UserUnitOfWork,
    );
  });

  it('answers from the deciding snapshot with its moment when nothing is to store', async () => {
    jest.spyOn(service, 'runsUpToDate').mockResolvedValue(true);
    const answer = jest.fn(() => Promise.resolve('as stored'));

    expect(await service.answerAsOfNow('user', answer)).toBe('as stored');
    expect(answer).toHaveBeenCalledWith(snapshot, BEFORE);
    expect(run).not.toHaveBeenCalled();
  });

  it('answers under the lock with a moment taken after it when runs are to store', async () => {
    const upToDate = jest
      .spyOn(service, 'runsUpToDate')
      .mockResolvedValue(false);
    const answer = jest.fn(() => Promise.resolve('caught up'));

    expect(await service.answerAsOfNow('user', answer)).toBe('caught up');
    expect(upToDate).toHaveBeenCalledWith(snapshot, 'user', BEFORE);
    // One answer only, never from the snapshot that decided to store.
    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer).toHaveBeenCalledWith(locked, AFTER_LOCK);
  });
});
