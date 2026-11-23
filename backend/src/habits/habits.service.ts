import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { assertOwnedCategory, normalizeWhy } from '../categories/assignment';
import { initialScheduleInstant } from '../common/date/date-only.utils';
import { dayOf } from '../common/date/local-day';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { isOccurrenceTimerEligible } from '../timers/timer-target';
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

  private validTitle(title: string): string {
    const trimmed = title.trim();

    if (trimmed.length === 0 || trimmed.length > 200) {
      throw new BadRequestException('Invalid habit title');
    }

    return trimmed;
  }

  async findAll(userId: string): Promise<HabitResponseDto[]> {
    const due = await this.scheduling.getToday(userId);
    const habits = await this.dataSource.getRepository(HabitEntity).find({
      where: { userId },
      order: { id: 'ASC' },
    });

    // One query for all schedule versions instead of one per habit.
    const versions = habits.length
      ? await this.dataSource.getRepository(HabitScheduleVersionEntity).find({
          where: { habitId: In(habits.map((habit) => habit.id)) },
          order: { effectiveAt: 'ASC', id: 'ASC' },
        })
      : [];
    const now = this.clock.now();
    const ancestry = await loadTodoAncestry(
      this.dataSource.manager,
      userId,
      dayOf(now),
    );
    const streaks = await loadStreaks(
      this.dataSource.manager,
      habits.map((habit) => habit.id),
      now,
      true,
    );
    const challenged = await challengeHabitIds(
      this.dataSource.manager,
      userId,
      dayOf(now),
    );
    const result: HabitResponseDto[] = [];

    for (const habit of habits) {
      result.push(
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
    }

    return result;
  }

  async findOne(userId: string, id: number): Promise<HabitResponseDto> {
    // Reconcile and read one owned Habit under the same Habit lock and reference time.
    // Opening its editor must not generate occurrences for every other Habit.
    return this.unitOfWork.run(userId, async (manager) => {
      const now = this.clock.now();
      const { habit, versions } = await this.scheduling.openHabit(
        manager,
        userId,
        id,
        now,
      );

      const pending = (
        await manager
          .getRepository(HabitOccurrenceEntity)
          .findBy({ habitId: id, status: HabitOccurrenceStatus.PENDING })
      ).find((item) => isOccurrenceTimerEligible(item, habit, dayOf(now)));

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
    const title = this.validTitle(dto.title);
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
          title,
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
      const habit = await this.scheduling.lockHabit(userId, manager, id);

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
        habit.title = this.validTitle(dto.title);
      }

      if (dto.isActive !== undefined) {
        habit.isActive = dto.isActive;
      }

      const now = this.clock.now();
      await this.scheduling.saveHabit(manager, habit, now);

      return this.scheduling.habitResponse(
        habit,
        await this.scheduling.getVersions(manager, id),
        await loadTodoAncestry(manager, userId, dayOf(now)),
        now,
        undefined,
        await this.scheduling.streakOf(manager, id, now),
        await this.scheduling.carriesChallenge(manager, userId, id, now),
      );
    });
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
