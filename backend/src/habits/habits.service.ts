import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { assertOwnedCategory, normalizeWhy } from '../categories/assignment';
import { initialScheduleInstant } from '../common/date/date-only.utils';
import { dayOf } from '../common/date/local-day';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { ChangeHabitScheduleDto } from './dto/change-habit-schedule.dto';
import {
  HabitResponseDto,
  ScheduleVersionResponse,
} from './dto/habit-response.dto';
import { HabitEntity } from './entities/habit.entity';
import { HabitScheduleVersionEntity } from './entities/habit-schedule-version.entity';
import { HabitSchedulingService } from './scheduling/habit-scheduling.service';
import { runRefusal } from './scheduling/run-actionability';
import { loadTodoAncestry } from '../todos/todo-ancestry';
import { buildVersion, normalizeSchedule } from './scheduling/schedule-rules';
import { assertCampaignTarget } from './habit-campaign';
import { loadStreaks } from './streaks';
import { challengeHabitIds } from '../month-challenges/challenge-store';

@Injectable()
export class HabitsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scheduling: HabitSchedulingService,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  /**
   * The Daily list: every habit of the user, from one snapshot with one
   * `now` (`answerAsOfNow`), so the run a stopwatch can start on, the
   * series and the marker speak of the same moment.
   */
  findAll(userId: string): Promise<HabitResponseDto[]> {
    return this.scheduling.answerAsOfNow(userId, async (manager, now) => {
      const today = dayOf(now);
      const due = await this.scheduling.todayRuns(manager, userId, now);
      const habits = await manager.getRepository(HabitEntity).find({
        where: { userId },
        order: { id: 'ASC' },
      });

      // One query for all schedule versions instead of one per habit.
      const versions = habits.length
        ? await manager.getRepository(HabitScheduleVersionEntity).find({
            where: { habitId: In(habits.map((habit) => habit.id)) },
            order: { effectiveAt: 'ASC', id: 'ASC' },
          })
        : [];
      const ancestry = await loadTodoAncestry(manager, userId, today);
      const streaks = await loadStreaks(
        manager,
        habits.map((habit) => habit.id),
        now,
        true,
      );
      const challenged = await challengeHabitIds(manager, userId, today);

      return habits.map((habit) =>
        this.scheduling.habitResponse(
          habit,
          versions.filter((version) => version.habitId === habit.id),
          ancestry,
          now,
          due.find(
            (item) =>
              item.habitId === habit.id &&
              item.status === HabitOccurrenceStatus.PENDING,
          ),
          streaks.get(habit.id),
          challenged.has(habit.id),
        ),
      );
    });
  }

  async findOne(userId: string, id: number): Promise<HabitResponseDto> {
    // Reconcile and read one owned Habit at one reference time. Opening its
    // editor must not generate occurrences for every other Habit.
    return this.unitOfWork.run(userId, async (manager) => {
      const now = this.clock.now();
      const { habit, versions } = await this.scheduling.openHabit(
        manager,
        userId,
        id,
        now,
      );

      // The run the stopwatch can start on.
      const pending = (
        await manager
          .getRepository(HabitOccurrenceEntity)
          .findBy({ habitId: id, status: HabitOccurrenceStatus.PENDING })
      ).find(
        (run) =>
          runRefusal({
            run,
            version: versions.find((item) => item.id === run.scheduleVersionId),
            habit,
            now,
          }) === null,
      );

      return this.scheduling.habitResponse(
        habit,
        versions,
        await loadTodoAncestry(manager, userId, dayOf(now)),
        now,
        pending,
        await this.scheduling.streakOf(manager, id, now),
        await this.scheduling.carriesChallenge(manager, userId, id, now),
      );
    });
  }

  async findVersions(
    userId: string,
    id: number,
  ): Promise<ScheduleVersionResponse[]> {
    // History needs ownership validation, not occurrence generation or a write lock.
    const habit = await this.dataSource
      .getRepository(HabitEntity)
      .findOneBy({ id, userId });
    if (!habit)
      throw new NotFoundException(`Habit with ID ${id} was not found`);

    const versions = await this.scheduling.getVersions(
      this.dataSource.manager,
      id,
    );

    return versions.map((version) => this.scheduling.versionResponse(version));
  }

  async create(userId: string, dto: CreateHabitDto): Promise<HabitResponseDto> {
    const definition = normalizeSchedule(dto.schedule);

    return this.unitOfWork.run(userId, async (manager) => {
      const now = this.clock.now();

      const effectiveAt = initialScheduleInstant(
        dto.startDate ?? dayOf(now),
        now,
      );

      const repository = manager.getRepository(HabitEntity);
      const categoryId = dto.categoryId ?? null;
      await assertOwnedCategory(manager, userId, categoryId);
      const campaignId = dto.campaignId ?? null;
      await assertCampaignTarget(manager, userId, campaignId);

      const habit = await repository.save(
        repository.create({
          categoryId,
          campaignId,
          why: normalizeWhy(dto.why),
          plannedDurationMinutes: dto.plannedDurationMinutes ?? null,
          timeOfDay: dto.timeOfDay ?? null,
          focusBlock: dto.focusBlock ?? 'default',
          userId,
          title: dto.title,
          isActive: true,
        }),
      );

      const version = await manager
        .getRepository(HabitScheduleVersionEntity)
        .save(buildVersion(habit.id, definition, effectiveAt));

      return this.scheduling.habitResponse(
        habit,
        [version],
        await loadTodoAncestry(manager, userId, dayOf(now)),
        now,
      );
    });
  }

  async update(
    userId: string,
    id: number,
    dto: UpdateHabitDto,
  ): Promise<HabitResponseDto> {
    if (
      dto.title === undefined &&
      dto.isActive === undefined &&
      dto.plannedDurationMinutes === undefined &&
      dto.timeOfDay === undefined &&
      dto.categoryId === undefined &&
      dto.campaignId === undefined &&
      dto.why === undefined &&
      dto.focusBlock === undefined
    ) {
      throw new BadRequestException('At least one property must be provided');
    }

    return this.unitOfWork.run(userId, async (manager) => {
      const now = this.clock.now();
      const { habit, versions } = await this.scheduling.editHabit(
        manager,
        userId,
        id,
        now,
        (habit) => this.applyUpdate(manager, userId, habit, dto),
      );

      return this.scheduling.habitResponse(
        habit,
        versions,
        await loadTodoAncestry(manager, userId, dayOf(now)),
        now,
        undefined,
        await this.scheduling.streakOf(manager, id, now),
        await this.scheduling.carriesChallenge(manager, userId, id, now),
      );
    });
  }

  /** Puts the fields of an update on the stored habit (not saved yet). */
  private async applyUpdate(
    manager: EntityManager,
    userId: string,
    habit: HabitEntity,
    dto: UpdateHabitDto,
  ): Promise<void> {
    if (dto.categoryId !== undefined) {
      await assertOwnedCategory(manager, userId, dto.categoryId);
      habit.categoryId = dto.categoryId;
    }
    if (dto.campaignId !== undefined) {
      await assertCampaignTarget(manager, userId, dto.campaignId);
      habit.campaignId = dto.campaignId;
    }
    if (dto.why !== undefined) habit.why = normalizeWhy(dto.why);
    if (dto.plannedDurationMinutes !== undefined)
      habit.plannedDurationMinutes = dto.plannedDurationMinutes;
    const timeChanged =
      dto.timeOfDay !== undefined && dto.timeOfDay !== habit.timeOfDay;
    if (dto.timeOfDay !== undefined) habit.timeOfDay = dto.timeOfDay;
    if (dto.focusBlock !== undefined) habit.focusBlock = dto.focusBlock;
    if (timeChanged)
      // Like a quest with a new time: its open runs take their place anew,
      // right after the appointment before them on the clock (day-order.ts).
      await manager
        .getRepository(HabitOccurrenceEntity)
        .update(
          { habitId: habit.id, status: HabitOccurrenceStatus.PENDING },
          { dayPosition: null },
        );
    if (dto.title !== undefined) {
      habit.title = dto.title;
    }

    if (dto.isActive !== undefined) {
      habit.isActive = dto.isActive;
    }
  }

  changeSchedule(
    userId: string,
    id: number,
    dto: ChangeHabitScheduleDto,
  ): Promise<HabitResponseDto> {
    return this.scheduling.changeSchedule(userId, id, dto);
  }

  async remove(userId: string, id: number): Promise<void> {
    await this.unitOfWork.run(userId, (manager) =>
      this.scheduling.removeHabit(manager, userId, id, this.clock.now()),
    );
  }
}
