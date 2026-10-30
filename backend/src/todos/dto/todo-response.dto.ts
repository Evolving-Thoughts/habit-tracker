export type TodoResponseDtoProperties = {
  id: number;
  parentId?: number | null;
  categoryId?: number | null;
  why?: string | null;
  title: string;
  completed: boolean;
  completedAt: string | null;
  scheduledAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
  /** Whether a timer may be started for this todo (see timer-target). */
  timerEligible: boolean;
};

export class TodoResponseDto {
  readonly id: number;
  readonly parentId: number | null;
  readonly categoryId: number | null;
  readonly why: string | null;
  readonly title: string;
  readonly completed: boolean;
  readonly completedAt: string | null;
  readonly scheduledAt: string | null;
  readonly plannedDurationMinutes: number | null;
  readonly isFixed: boolean;
  readonly timerEligible: boolean;

  constructor(properties: TodoResponseDtoProperties) {
    this.id = properties.id;
    this.parentId = properties.parentId ?? null;
    this.categoryId = properties.categoryId ?? null;
    this.why = properties.why ?? null;
    this.title = properties.title;
    this.completed = properties.completed;
    this.completedAt = properties.completedAt;
    this.scheduledAt = properties.scheduledAt;
    this.plannedDurationMinutes = properties.plannedDurationMinutes;
    this.isFixed = properties.isFixed;
    this.timerEligible = properties.timerEligible;
  }
}
