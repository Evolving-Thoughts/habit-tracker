# The week plan (Plan)

A board of seven day columns, Monday to Sunday in Europe/Berlin, to plan a
week the way Heute plans a day. It reads and writes the same model as Heute
(see `day-order.md`): a todo has its day, an appointment also a time, and
everything else follows the order of its day.

## Read: `GET /day-planner/week?start=YYYY-MM-DD`

`start` must be a Monday (`week-plan.ts` `weekDates`; anything else is 400,
as is a malformed or out-of-range date or an unknown query field). The answer
is one `REPEATABLE READ` snapshot that reconciles and generates nothing:

```ts
{ startDate, endDate, today, days: [{ date, entries: WeekPlanEntry[] }] }
```

Each day lists its open entries in the order of the day, then the resolved
ones in that same order (`arrangeWeek`, sorting with `day-order.ts`
`compareInDay`). An entry is a todo (`todoId`, `status`, `scheduledDate`) or a
habit run (`habitId`, `occurrenceId`, `status`), both with `title`,
`timeOfDay`, `plannedDurationMinutes`, `campaign` (`todo-ancestry.ts`) and
`isOverdue`.

Where things show up, built from the existing definitions instead of a second
projection:

- **Open todos** follow the todo agenda (`todo-agenda.ts`): on their day, or
  on today when overdue (with their original `scheduledDate`). A week that
  lies entirely in the past has no open entries.
- **Completed todos** sit on the day they were completed (`completedTodos`).
- **Open habit runs** come from the forecast history uses
  (`history/habit-forecast.ts` → `history-planning.ts` `plannedHabits`): a
  stored pending run where it exists, otherwise a run the schedule forecasts,
  with `occurrenceId: null`. Forecast runs are never written by this read;
  they have no position, so they follow everything sorted. Weekly-target
  dailies have no day of their own and are not shown, as in the calendar's
  day lists.
- **Resolved runs** (`resolvedOccurrences`): a completed one on the day it
  was done, a skipped one on its due day.

Every query is scoped to the user; occurrences through their habit.

## Write: the existing paths

The board has no write endpoint of its own.

- **Within a day** it stores the day's order with `PUT /day-planner/order`.
  That endpoint was never tied to today: a position only counts among the
  items of the day an item is on, so it orders any day.
- **To another day** it moves the quest with `POST /todos/:id/reschedule`
  (which resets its position, see `day-order.md`) and then stores the target
  day's order, so the quest lands where it was dropped. An appointment is
  moved with `confirmFixed` (the drag is the confirmation), keeps its time
  and needs no order.
- Dropping an overdue quest on today plans it for today.
- The past takes no drops, and reschedule refuses past days anyway.
- The day's order sent to the server holds the open untimed entries that are
  stored: quests and stored habit runs, not appointments, not carried-over
  entries, not forecast runs (`utils/week-plan.ts` `dayOrder`).

## Frontend

- `views/PlanView.vue` (`#/plan`, the week in `?woche=<Monday>`; the current
  week has the plain address). Week switcher, the range as heading, loading
  skeleton, load error with retry, a lead when an upcoming week is empty.
- `components/PlanDay.vue`: one column (heading, "n offen · Dauer", the open
  list as a SortableJS list in the group `week-plan`, quick add, then what is
  done). Past columns take no drops and offer no quick add.
- `components/PlanEntry.vue`: a compact row. A quest's title opens
  `EditItemDialog`; its grip is its one move control: drag it, use Arrow
  Up/Down (place in the day) and Left/Right (day before/after), or tap it for
  `MoveItemDialog`. Dailies are fixed rows without controls.
- `utils/week-plan.ts`: the pure rules: `dropOnDay` applies a drop to the plan
  at once and says what to write, `arrowDrop` turns arrow keys into drops,
  `arrangeOpen` mirrors the server's sorting for the optimistic view.
- Writes go through `useWrites` (one at a time, then `notifyDataChanged` and a
  quiet reload). A failed write puts the old plan back at once, shows the
  error and reloads quietly to show what the server kept.
- `useSortable` takes an optional `group` (and `accepts`) so lists trade
  items; it reports the drop's target list and its index among all children.
- `QuickAddQuest` takes `choosePlace: false` for the board: Enter creates the
  quest on that day at the end of its order.
- A phone shows one day at a time (scroll snapping); the current week opens
  scrolled to today. The page itself never scrolls sideways.
