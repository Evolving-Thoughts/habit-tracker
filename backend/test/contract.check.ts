/**
 * Holds the backend DTOs against the frontend's hand-written types, so drift
 * fails `npm run check:contract` instead of the app. Types only; nothing runs.
 */
import type { CategoryResponse as CategoryResponseDto } from '../src/categories/category.dto';
import type { DayPlannerResponseDto } from '../src/day-planner/dto/day-planner-response.dto';
import type { WeekPlanResponseDto } from '../src/day-planner/dto/week-plan.dto';
import type { HabitOccurrenceResponseDto } from '../src/habit-occurrences/dto/habit-occurrence-response.dto';
import type { CreateHabitDto } from '../src/habits/dto/create-habit.dto';
import type { HabitResponseDto } from '../src/habits/dto/habit-response.dto';
import type { UpdateHabitDto } from '../src/habits/dto/update-habit.dto';
import type { HistoryResponse as HistoryResponseDto } from '../src/history/history.dto';
import type {
  QuestHoursResponse as QuestHoursResponseDto,
  QuestTargetDto,
  QuestTargetResponse,
} from '../src/quest-hours/quest-hours.dto';
import type {
  CAMPAIGN_COLORS as BACKEND_COLORS,
  CAMPAIGN_ICONS as BACKEND_ICONS,
} from '../src/todos/campaign-style';
import type { TimerResponse as TimerResponseDto } from '../src/timers/timers.service';
import type { CreateTodoDto } from '../src/todos/dto/create-todo.dto';
import type { TodoResponseDto } from '../src/todos/dto/todo-response.dto';
import type { UpdateTodoDto } from '../src/todos/dto/update-todo.dto';
import type {
  SaveWeekReviewDto,
  WeekReviewAnswers as WeekReviewAnswersDto,
  WeekReviewResponse as WeekReviewResponseDto,
} from '../src/week-review/week-review.dto';
import type { WorkLogResponse } from '../src/work-logs/work-log.dto';
import type { DayPlannerResponse } from '../../frontend/src/types/day-planner';
import type { WeekPlanResponse } from '../../frontend/src/types/week-plan';
import type {
  CreateHabitInput,
  HabitOccurrenceResponse,
  HabitResponse,
  UpdateHabitInput,
} from '../../frontend/src/types/habit';
import type {
  CAMPAIGN_COLORS,
  CAMPAIGN_ICONS,
} from '../../frontend/src/types/campaign';
import type { CategoryResponse } from '../../frontend/src/types/category';
import type { HistoryResponse } from '../../frontend/src/types/history';
import type {
  QuestHoursResponse,
  QuestTarget,
} from '../../frontend/src/types/quest-hours';
import type { TimerResponse } from '../../frontend/src/types/timer';
import type {
  CreateTodoInput,
  TodoResponse,
  UpdateTodoInput,
} from '../../frontend/src/types/todo';
import type {
  WeekReviewAnswers,
  WeekReviewInput,
  WeekReviewResponse,
} from '../../frontend/src/types/week-review';
import type { WorkLog } from '../../frontend/src/types/work-log';

/** What a value looks like after JSON: enums are strings, dates too. */
type Json<T> = T extends Date
  ? string
  : T extends string
    ? `${T}`
    : T extends (infer Item)[]
      ? Json<Item>[]
      : T extends object
        ? { [Key in keyof T]: Json<T[Key]> }
        : T;

type Assert<Holds extends true> = Holds;

/** The response the backend sends fits what the frontend reads. */
type Reads<Dto, Frontend> = [Json<Dto>] extends [Frontend] ? true : false;

/** The frontend sends no field the backend would refuse as unknown. */
type Sends<Frontend, Dto> = [keyof Frontend] extends [keyof Dto] ? true : false;

/** Both sides list the same keys in the same order. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export type Contract = [
  Assert<Reads<TodoResponseDto, TodoResponse>>,
  Assert<Reads<CategoryResponseDto, CategoryResponse>>,
  Assert<Reads<HabitResponseDto, HabitResponse>>,
  Assert<Reads<HabitOccurrenceResponseDto, HabitOccurrenceResponse>>,
  Assert<Reads<DayPlannerResponseDto, DayPlannerResponse>>,
  Assert<Reads<WeekPlanResponseDto, WeekPlanResponse>>,
  Assert<Reads<HistoryResponseDto, HistoryResponse>>,
  Assert<Reads<TimerResponseDto, TimerResponse>>,
  Assert<Reads<WorkLogResponse, WorkLog>>,
  Assert<Reads<QuestHoursResponseDto, QuestHoursResponse>>,
  Assert<Reads<QuestTargetResponse, QuestTarget>>,
  Assert<Sends<QuestTarget, QuestTargetDto>>,
  Assert<Reads<WeekReviewResponseDto, WeekReviewResponse>>,
  Assert<Reads<WeekReviewAnswersDto, WeekReviewAnswers>>,
  Assert<Sends<WeekReviewInput, SaveWeekReviewDto>>,
  Assert<Same<typeof BACKEND_COLORS, typeof CAMPAIGN_COLORS>>,
  Assert<Same<typeof BACKEND_ICONS, typeof CAMPAIGN_ICONS>>,
  Assert<Sends<CreateTodoInput, CreateTodoDto>>,
  Assert<Sends<UpdateTodoInput, UpdateTodoDto>>,
  Assert<Sends<CreateHabitInput, CreateHabitDto>>,
  Assert<Sends<UpdateHabitInput, UpdateHabitDto>>,
];
