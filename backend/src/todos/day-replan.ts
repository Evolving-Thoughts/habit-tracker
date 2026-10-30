const MINUTE_MS = 60_000;
const MIN_PIECE_MINUTES = 10;

export type ReplanTodo = {
  id: number;
  title: string;
  start: number;
  minutes: number | null;
  isFixed: boolean;
  /** A running or paused timer keeps a todo where it is. */
  locked: boolean;
};

export type ReplanPiece = { start: number; minutes: number };

export type ReplanChange = {
  todoId: number;
  title: string;
  from: number;
  /** First piece keeps the todo; further ones become continuations. */
  pieces: ReplanPiece[];
  /** Remainder that no longer fits today, for tomorrow. */
  tomorrowMinutes: number;
};

type Block = { start: number; end: number };

/**
 * Plans a day without touching fixed todos: a flexible todo that collides is
 * split when at least ten minutes fit before the fixed one, otherwise it moves
 * behind it; later flexible todos follow as a chain. Work that would end after
 * `dayEnd` is left for tomorrow. Todos without a duration have no length and
 * stay where they are. Pure, so the same input gives the same proposal.
 */
export function replanDay(
  todos: ReplanTodo[],
  now: number,
  dayEnd: number,
): ReplanChange[] {
  const anchored = (todo: ReplanTodo): boolean => todo.isFixed || todo.locked;
  const blocks: Block[] = todos
    .filter((todo) => anchored(todo) && todo.minutes !== null)
    .map((todo) => ({
      start: todo.start,
      end: todo.start + todo.minutes! * MINUTE_MS,
    }))
    .sort((a, b) => a.start - b.start);
  const flexible = todos
    .filter((todo) => !anchored(todo) && todo.minutes !== null)
    .sort((a, b) => a.start - b.start || a.id - b.id);

  const changes: ReplanChange[] = [];
  let cursor = now;
  for (const todo of flexible) {
    const pieces: ReplanPiece[] = [];
    let remaining = todo.minutes!;
    let start = Math.max(todo.start, cursor);
    while (remaining > 0 && start < dayEnd) {
      const end = start + remaining * MINUTE_MS;
      const block = blocks.find((item) => item.start < end && item.end > start);
      if (!block) {
        if (end > dayEnd) break;
        pieces.push({ start, minutes: remaining });
        remaining = 0;
        cursor = end;
        break;
      }
      const free = Math.floor((block.start - start) / MINUTE_MS);
      if (free >= MIN_PIECE_MINUTES) {
        pieces.push({ start, minutes: free });
        remaining -= free;
      }
      start = block.end;
    }
    const untouched =
      remaining === 0 && pieces.length === 1 && pieces[0].start === todo.start;
    if (!untouched)
      changes.push({
        todoId: todo.id,
        title: todo.title,
        from: todo.start,
        pieces,
        tomorrowMinutes: remaining,
      });
  }
  return changes;
}
