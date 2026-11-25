import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EntityManager, In } from 'typeorm';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { TimerEntity } from '../timers/timer.entity';
import { elapsedAt } from '../timers/timer-math';
import { TodoEntity } from '../todos/entities/todo.entity';
import type {
  AddFocusEntryDto,
  FocusBlockRequestDto,
  FocusBlockStateResponse,
  FocusEntryResponse,
  SaveFocusSettingsDto,
} from './focus-block.dto';
import {
  FocusBlockEntity,
  FocusBlockEntryEntity,
  FocusBlockSettingsEntity,
} from './focus-block.entities';
import {
  assertListChangeAllowed,
  assertLiftable,
  MAX_ENTRIES_PER_LIST,
  normalizeDomain,
  normalizePackage,
  type FocusBlockOverride,
} from './focus-block-rules';
import {
  openFocusBlock,
  readFocusSettings,
  startFocusBlock,
} from './focus-block-store';

/**
 * The hosts the app itself needs: its own origin. A block never stops
 * them, so the app and its server stay reachable in every browser.
 */
export function fixedFocusDomains(): string[] {
  try {
    const host = new URL(process.env.FRONTEND_URL ?? '').hostname;
    return host ? [host] : [];
  } catch {
    return [];
  }
}

/** Fokus-Sperre: settings, the two lists and the block session. */
@Injectable()
export class FocusBlocksService {
  constructor(
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  state(userId: string): Promise<FocusBlockStateResponse> {
    return this.unitOfWork.run(userId, (manager) =>
      this.read(manager, userId, this.clock.now()),
    );
  }

  saveSettings(
    userId: string,
    dto: SaveFocusSettingsDto,
  ): Promise<FocusBlockStateResponse> {
    return this.unitOfWork.run(userId, async (manager) => {
      const current = await readFocusSettings(manager, userId);
      await manager.upsert(
        FocusBlockSettingsEntity,
        {
          userId,
          enabled: dto.enabled ?? current.enabled,
          trigger: dto.trigger ?? current.trigger,
          thresholdMinutes: dto.thresholdMinutes ?? current.thresholdMinutes,
          mode: dto.mode ?? current.mode,
          listMode: dto.listMode ?? current.listMode,
        },
        ['userId'],
      );
      return this.read(manager, userId, this.clock.now());
    });
  }

  addEntry(
    userId: string,
    dto: AddFocusEntryDto,
  ): Promise<FocusBlockStateResponse> {
    const value =
      dto.kind === 'domain'
        ? normalizeDomain(dto.value)
        : normalizePackage(dto.value);
    return this.unitOfWork.run(userId, async (manager) => {
      const now = this.clock.now();
      await this.assertListChange(manager, userId, dto.list, 'add', now);
      const count = await manager.countBy(FocusBlockEntryEntity, {
        userId,
        list: dto.list,
        kind: dto.kind,
      });
      if (count >= MAX_ENTRIES_PER_LIST)
        throw new ConflictException(
          `Höchstens ${MAX_ENTRIES_PER_LIST} Einträge je Liste.`,
        );
      // The same entry twice changes nothing.
      await manager
        .createQueryBuilder()
        .insert()
        .into(FocusBlockEntryEntity)
        .values({
          userId,
          list: dto.list,
          kind: dto.kind,
          value,
          label: dto.kind === 'app' ? dto.label?.trim() || null : null,
        })
        .orIgnore()
        .execute();
      return this.read(manager, userId, now);
    });
  }

  removeEntry(userId: string, id: number): Promise<FocusBlockStateResponse> {
    return this.unitOfWork.run(userId, async (manager) => {
      const entry = await manager.findOneBy(FocusBlockEntryEntity, {
        id,
        userId,
      });
      if (!entry) throw new NotFoundException('Eintrag nicht gefunden.');
      const now = this.clock.now();
      await this.assertListChange(manager, userId, entry.list, 'remove', now);
      await manager.delete(FocusBlockEntryEntity, { id, userId });
      return this.read(manager, userId, now);
    });
  }

  /**
   * "Sperre starten" on the Fokus screen while the stopwatch already runs
   * (started elsewhere): a block for its quest or run, whatever the trigger
   * says, since the person asked for it.
   */
  start(
    userId: string,
    dto: FocusBlockRequestDto,
  ): Promise<FocusBlockStateResponse> {
    return this.unitOfWork.run(userId, async (manager) => {
      const now = this.clock.now();
      const timer = await manager.findOne(TimerEntity, {
        where: { userId, state: In(['running', 'paused']) },
      });
      if (!timer)
        throw new ConflictException({
          message: 'Eine Sperre beginnt mit der Stoppuhr. Starte sie zuerst.',
          code: 'NO_ACTIVE_TIMER',
        });
      await startFocusBlock(
        manager,
        userId,
        {
          target:
            timer.todoId !== null
              ? { todoId: timer.todoId }
              : { occurrenceId: timer.occurrenceId! },
          title: timer.title,
          override: await this.overrideOf(manager, userId, timer),
          targetMinutes: timer.targetMinutes,
          elapsedMilliseconds: elapsedAt(timer, now),
          mode: dto.mode,
          force: true,
        },
        now,
      );
      return this.read(manager, userId, now);
    });
  }

  /** Lifts a Soft block; a Hardcore block answers 409. */
  end(userId: string): Promise<FocusBlockStateResponse> {
    return this.unitOfWork.run(userId, async (manager) => {
      const now = this.clock.now();
      const block = await openFocusBlock(manager, userId, now);
      if (block) {
        assertLiftable(block, now);
        block.endedAt = now;
        block.endReason = 'lifted';
        await manager.save(FocusBlockEntity, block);
      }
      return this.read(manager, userId, now);
    });
  }

  private async overrideOf(
    manager: EntityManager,
    userId: string,
    timer: TimerEntity,
  ): Promise<FocusBlockOverride> {
    if (timer.todoId !== null) {
      const todo = await manager.findOneBy(TodoEntity, {
        id: timer.todoId,
        userId,
      });
      return todo?.focusBlock ?? 'default';
    }
    const occurrence = await manager.findOne(HabitOccurrenceEntity, {
      where: { id: timer.occurrenceId! },
      relations: { habit: true },
    });
    return occurrence?.habit?.focusBlock ?? 'default';
  }

  private async assertListChange(
    manager: EntityManager,
    userId: string,
    list: 'block' | 'allow',
    action: 'add' | 'remove',
    now: Date,
  ): Promise<void> {
    const block = await openFocusBlock(manager, userId, now);
    assertListChangeAllowed(block?.mode === 'hardcore', { list, action });
  }

  private async read(
    manager: EntityManager,
    userId: string,
    now: Date,
  ): Promise<FocusBlockStateResponse> {
    const block = await openFocusBlock(manager, userId, now);
    const settings = await readFocusSettings(manager, userId);
    const entries = await manager.find(FocusBlockEntryEntity, {
      where: { userId },
      order: { kind: 'ASC', value: 'ASC' },
    });
    const entry = ({
      id,
      kind,
      value,
      label,
    }: FocusBlockEntryEntity): FocusEntryResponse => ({
      id,
      kind,
      value,
      label,
    });
    const content: Omit<FocusBlockStateResponse, 'version' | 'serverNow'> = {
      settings,
      block: block
        ? {
            id: block.id,
            title: block.title,
            todoId: block.todoId,
            occurrenceId: block.occurrenceId,
            mode: block.mode,
            listMode: block.listMode,
            startedAt: block.startedAt.toISOString(),
            endsAt: block.endsAt?.toISOString() ?? null,
          }
        : null,
      lists: {
        block: entries.filter((row) => row.list === 'block').map(entry),
        allow: entries.filter((row) => row.list === 'allow').map(entry),
      },
      fixedDomains: fixedFocusDomains(),
    };
    return {
      version: createHash('sha256')
        .update(JSON.stringify(content))
        .digest('hex')
        .slice(0, 20),
      serverNow: now.toISOString(),
      ...content,
    };
  }
}
