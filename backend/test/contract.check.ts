/**
 * Holds the backend DTOs against the frontend's hand-written types, so drift
 * fails `npm run check:contract` instead of the app. Types only; nothing runs.
 */
import type { DayPlannerResponseDto } from '../src/day-planner/dto/day-planner-response.dto';
import type { CreateHabitDto } from '../src/habits/dto/create-habit.dto';
import type { HabitResponseDto } from '../src/habits/dto/habit-response.dto';
import type { UpdateHabitDto } from '../src/habits/dto/update-habit.dto';
import type { HistoryResponse as HistoryResponseDto } from '../src/history/history.dto';
import type { TimerResponse as TimerResponseDto } from '../src/timers/timers.service';
import type { CreateTodoDto } from '../src/todos/dto/create-todo.dto';
import type { ReplanPreviewResponse } from '../src/todos/dto/replan.dto';
import type { TodoResponseDto } from '../src/todos/dto/todo-response.dto';
import type { UpdateTodoDto } from '../src/todos/dto/update-todo.dto';
import type { WorkDayResponse } from '../src/work-logs/work-log.dto';
import type { DayPlannerResponse } from '../../frontend/src/types/day-planner';
import type {
  CreateHabitInput,
  HabitResponse,
  UpdateHabitInput,
} from '../../frontend/src/types/habit';
import type { HistoryResponse } from '../../frontend/src/types/history';
import type { ReplanPreview } from '../../frontend/src/types/replan';
import type { TimerResponse } from '../../frontend/src/types/timer';
import type {
  CreateTodoInput,
  TodoResponse,
  UpdateTodoInput,
} from '../../frontend/src/types/todo';
import type { WorkDay } from '../../frontend/src/types/work-log';

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

export type Contract = [
  Assert<Reads<TodoResponseDto, TodoResponse>>,
  Assert<Reads<HabitResponseDto, HabitResponse>>,
  Assert<Reads<DayPlannerResponseDto, DayPlannerResponse>>,
  Assert<Reads<HistoryResponseDto, HistoryResponse>>,
  Assert<Reads<TimerResponseDto, TimerResponse>>,
  Assert<Reads<WorkDayResponse, WorkDay>>,
  Assert<Reads<ReplanPreviewResponse, ReplanPreview>>,
  Assert<Sends<CreateTodoInput, CreateTodoDto>>,
  Assert<Sends<UpdateTodoInput, UpdateTodoDto>>,
  Assert<Sends<CreateHabitInput, CreateHabitDto>>,
  Assert<Sends<UpdateHabitInput, UpdateHabitDto>>,
];
