import type { TimerState } from '../../timers/timer.entity';
import type { TodoProgress } from '../todo-hierarchy';
import type { TodoResponseDto } from './todo-response.dto';

/** GET /todos/hierarchy: every todo with the progress of its subtree. */
export type HierarchyTodoResponse = TodoResponseDto & {
  progress: TodoProgress;
};

/** GET /todos/:id/deletion-preview: what a confirmed delete would remove. */
export type DeletionPreviewResponse = {
  /** Binds the delete to exactly this preview; send it with DELETE. */
  confirmationToken: string;
  todos: {
    id: number;
    title: string;
    parentId: number | null;
    completed: boolean;
  }[];
  timers: {
    id: string;
    todoId: number;
    title: string;
    state: TimerState;
  }[];
};
