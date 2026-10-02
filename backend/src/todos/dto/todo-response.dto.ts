export type TodoResponseDtoProperties = {
  id: number;
  title: string;
  completed: boolean;
  completedAt: string | null;
  scheduledAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
};

export class TodoResponseDto {
  readonly id: number;
  readonly title: string;
  readonly completed: boolean;
  readonly completedAt: string | null;
  readonly scheduledAt: string | null;
  readonly plannedDurationMinutes: number | null;
  readonly isFixed: boolean;

  constructor(properties: TodoResponseDtoProperties) {
    this.id = properties.id;
    this.title = properties.title;
    this.completed = properties.completed;
    this.completedAt = properties.completedAt;
    this.scheduledAt = properties.scheduledAt;
    this.plannedDurationMinutes = properties.plannedDurationMinutes;
    this.isFixed = properties.isFixed;
  }
}
