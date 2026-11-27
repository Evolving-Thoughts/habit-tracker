import type { CampaignColor, CampaignIcon } from '../campaign-style';
import type { Campaign } from '../todo-ancestry';
import type { InheritedWhy } from '../todo-hierarchy';
import type { FocusBlockOverride } from '../../focus-blocks/focus-block-rules';

export type TodoResponseDtoProperties = {
  id: number;
  parentId?: number | null;
  categoryId?: number | null;
  why?: string | null;
  inheritedWhy?: InheritedWhy | null;
  /** The campaign it works towards (see todo-ancestry); null for a loose todo. */
  campaign?: Campaign | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  goalHabitId?: number | null;
  goalTarget?: number | null;
  weeklyTargetMinutes?: number | null;
  color?: CampaignColor | null;
  icon?: CampaignIcon | null;
  title: string;
  completed: boolean;
  completedAt: string | null;
  scheduledDate: string | null;
  timeOfDay: string | null;
  plannedDurationMinutes: number | null;
  focusBlock?: FocusBlockOverride;
  /** Whether a timer may be started for this todo (see timer-target). */
  timerEligible: boolean;
  blocked: boolean;
  setAsideAt: string | null;
};

export class TodoResponseDto {
  readonly id: number;
  readonly parentId: number | null;
  readonly categoryId: number | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly goalHabitId: number | null;
  readonly goalTarget: number | null;
  /** Campaign only: weekly goal of quest minutes, colour and icon keys. */
  readonly weeklyTargetMinutes: number | null;
  readonly color: CampaignColor | null;
  readonly icon: CampaignIcon | null;
  /** The todo's own reason. */
  readonly why: string | null;
  /** What it takes over from an ancestor while it has none of its own. */
  readonly inheritedWhy: InheritedWhy | null;
  /** The topmost todo above it, as on Heute and in the Plan. */
  readonly campaign: Campaign | null;
  readonly title: string;
  readonly completed: boolean;
  readonly completedAt: string | null;
  /** The planned day; null while the todo is in the backlog. */
  readonly scheduledDate: string | null;
  /** HH:mm of an appointment; null for a todo that only has its day. */
  readonly timeOfDay: string | null;
  readonly plannedDurationMinutes: number | null;
  /** Fokus-Sperre: the default rule, always or never. */
  readonly focusBlock: FocusBlockOverride;
  readonly timerEligible: boolean;
  /** Kampagnen-Board (campaign-board.md): the "Geblockt" marker. */
  readonly blocked: boolean;
  /** When it was last put back out of "In Arbeit". */
  readonly setAsideAt: string | null;

  constructor(properties: TodoResponseDtoProperties) {
    this.id = properties.id;
    this.parentId = properties.parentId ?? null;
    this.categoryId = properties.categoryId ?? null;
    this.periodStart = properties.periodStart ?? null;
    this.periodEnd = properties.periodEnd ?? null;
    this.goalHabitId = properties.goalHabitId ?? null;
    this.goalTarget = properties.goalTarget ?? null;
    this.weeklyTargetMinutes = properties.weeklyTargetMinutes ?? null;
    this.color = properties.color ?? null;
    this.icon = properties.icon ?? null;
    this.why = properties.why ?? null;
    this.inheritedWhy = properties.inheritedWhy ?? null;
    this.campaign = properties.campaign ?? null;
    this.title = properties.title;
    this.completed = properties.completed;
    this.completedAt = properties.completedAt;
    this.scheduledDate = properties.scheduledDate;
    this.timeOfDay = properties.timeOfDay;
    this.plannedDurationMinutes = properties.plannedDurationMinutes;
    this.focusBlock = properties.focusBlock ?? 'default';
    this.timerEligible = properties.timerEligible;
    this.blocked = properties.blocked;
    this.setAsideAt = properties.setAsideAt;
  }
}
