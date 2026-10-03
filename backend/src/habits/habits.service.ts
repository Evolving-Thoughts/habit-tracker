import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  getCurrentDateInTimeZone,
  initialScheduleInstant,
} from '../common/date/date-only.utils';
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
import { buildVersion, normalizeSchedule } from './scheduling/schedule-rules';

@Injectable()
export class HabitsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scheduling: HabitSchedulingService,
  ) {}

  private validTitle(title: string): string {
    const trimmed = title.trim();

    if (trimmed.length === 0 || trimmed.length > 200) {
      throw new BadRequestException('Invalid habit title');
    }

    return trimmed;
  }

  async findAll(userId: string): Promise<HabitResponseDto[]> {
    const habits = await this.dataSource.getRepository(HabitEntity).find({
      where: { userId },
      order: { id: 'ASC' },
    });

    const result: HabitResponseDto[] = [];

    for (const habit of habits) {
      result.push(
        this.scheduling.habitResponse(
          habit,
          await this.scheduling.getVersions(this.dataSource.manager, habit.id),
        ),
      );
    }

    return result;
  }

  async findOne(userId: string, id: number): Promise<HabitResponseDto> {
    const habit = await this.dataSource
      .getRepository(HabitEntity)
      .findOneBy({ id, userId });

    if (!habit) {
      throw new NotFoundException(`Habit with ID ${id} was not found`);
    }

    return this.scheduling.habitResponse(
      habit,
      await this.scheduling.getVersions(this.dataSource.manager, id),
    );
  }

  async findVersions(
    userId: string,
    id: number,
  ): Promise<ScheduleVersionResponse[]> {
    await this.findOne(userId, id);

    const versions = await this.scheduling.getVersions(
      this.dataSource.manager,
      id,
    );

    return versions.map((version) => this.scheduling.versionResponse(version));
  }

  async create(userId: string, dto: CreateHabitDto): Promise<HabitResponseDto> {
    const title = this.validTitle(dto.title);
    const definition = normalizeSchedule(dto.schedule);

    return this.dataSource.transaction(async (manager) => {
      const now = new Date();

      const effectiveAt = initialScheduleInstant(
        dto.startDate ?? getCurrentDateInTimeZone(),
        now,
      );

      const repository = manager.getRepository(HabitEntity);

      const habit = await repository.save(
        repository.create({
          userId,
          title,
          isActive: true,
        }),
      );

      const version = await manager
        .getRepository(HabitScheduleVersionEntity)
        .save(buildVersion(habit.id, definition, effectiveAt));

      return this.scheduling.habitResponse(habit, [version], now);
    });
  }

  async update(
    userId: string,
    id: number,
    dto: UpdateHabitDto,
  ): Promise<HabitResponseDto> {
    if (dto.title === undefined && dto.isActive === undefined) {
      throw new BadRequestException('At least one property must be provided');
    }

    return this.dataSource.transaction(async (manager) => {
      const habit = await this.scheduling.lockHabit(userId, manager, id);

      if (dto.title !== undefined) {
        habit.title = this.validTitle(dto.title);
      }

      if (dto.isActive !== undefined) {
        habit.isActive = dto.isActive;
      }

      await manager.getRepository(HabitEntity).save(habit);

      const now = new Date();

      await this.scheduling.reconcile(manager, habit, now);

      return this.scheduling.habitResponse(
        habit,
        await this.scheduling.getVersions(manager, id),
        now,
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
    await this.dataSource.transaction(async (manager) => {
      const habit = await this.scheduling.lockHabit(userId, manager, id);

      await manager.getRepository(HabitEntity).softRemove(habit);
    });
  }
}
