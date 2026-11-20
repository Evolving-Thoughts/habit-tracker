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
- **From the Questlog column** (below) a quest has no day yet, and
  `reschedule` refuses quests without one. It is planned with the Questlog
  editor's own save (`PATCH /todos/:id` with title, day, no time and its
  duration; `api/questlog.api.ts` `planQuest`, which the Questlog and its
  T/D/W use too), then the target day's order is stored, so it lands where
  it was dropped.

## The Questlog column

From 56rem the board has the Questlog on its left: the open quests without
a day that one can work on (`GET /todos/backlog`: no campaigns, no
Questreihen with open quests, see `todo-hierarchy.md`; it names each quest's
`campaign` like Heute's items do, so the column draws the stripe). It is a drag source in
the board's SortableJS group (`put: false`, so nothing is dropped back);
dropping a quest on a day applies `dropOnDay` with the quest as `incoming`
(it comes from no column and always moves), shows it there and removes it
from the column at once, then writes as above. A failed write puts both
back and reloads quietly, like any other drop.

The keyboard and touch alternative is each row's menu "Aktionen für …" with
"Einplanen auf …" for every day of the board from today on; it puts the
quest at the end of that day's order through the same path. T, D and W on
a column row do the same (beyond the board, next Monday is planned with the
editor's save alone), X ticks it with the undo toast and Space runs its
stopwatch.

Collapsed it is a rail as wide as its toggle (2.75rem) with the count.
Without a choice it starts open from 80rem and collapsed below
(`utils/week-plan.ts` `questlogStartsOpen`, reactive to the window); toggling
stores the explicit choice per device in `localStorage` (`plan:questlog` =
`open` or `closed`), which then wins at any width. Beside it a day column is
at least 8.5rem wide, enough for common German words at the entries' type
size, so the whole week fits from about 1100px beside the rail and from
1280px beside the open column. A phone has no column and loads nothing for
it.

## Widths, wrapping and where the board opens

- A day column has slim side padding (0.375rem); an entry gives its title
  the full width and puts its menu "…" below it (beside the details, if any).
  From a 15rem entry (a phone's single day) the menu sits beside title and
  details again. Below an 8.25rem entry the title is 0.875rem instead of
  0.9375rem.
- Titles wrap between words (`overflow-wrap: break-word`); only a word
  longer than the whole line breaks inside. `hyphens: auto` (words of ten
  characters and more) helps where the platform has a German dictionary, but
  the widths never rely on it. A title is clamped to three lines; its tooltip
  and accessible names keep it whole. The campaign's chip (icon and name)
  has its own line and ends in an ellipsis in narrow columns.
- The quick add's placeholder is "Quest hinzufügen …" where it fits and
  "Hinzufügen …" where not, measured against the field (`utils/fit-text.ts`,
  re-measured on resize and once the web font is in).
- Where the days do not fit, the board scrolls sideways inside itself and
  snaps to column starts. It opens at Monday while today is fully visible
  from there (always when the week fits); otherwise it scrolls as little as
  needed for today to be fully visible, landing on a column's start
  (`utils/week-plan.ts` `boardScroll`). A phone, where one day fills the
  view, thus opens on today.
- The loading bones take the board's columns (with the Questlog column
  where it exists) and are clipped, never scrolled.

## Frontend

- `views/PlanView.vue` (`#/plan`, the week in `?woche=<Monday>`; the current
  week has the plain address). Week switcher, the range as heading, loading
  skeleton, load error with retry, a lead when an upcoming week is empty.
  "Diese Woche" stands before the arrows and shows only away from the
  current week (`offersWayBack`; the Wochenrückblick and the Kalender's
  "Heute" follow the same rule); after it the focus goes to the heading.
- `components/PlanDay.vue`: one column (heading, "n offen · Dauer", the open
  list as a SortableJS list in the group `week-plan`, quick add, then what is
  done). Past columns take no drops and offer no quick add.
- `components/PlanEntry.vue`: a compact card. A quest's title, or a tap
  anywhere else on it, opens `EditItemDialog`; the whole card drags; its
  menu (built by `PlanView` with `rowMenu`) holds Morgen / Nächste Woche,
  "Anderer Tag …" (`MoveItemDialog`), Bearbeiten, Stoppuhr starten (a
  compact card has no ▶), "In Kampagne verschieben …"
  (`CampaignMoveDialog`), Nach oben / Nach unten in the day and Löschen
  (`DeleteItemDialog`, the editor's confirmation). With the focus on a
  quest's card (its title button), the arrow keys move it like dragging:
  ArrowUp / ArrowDown one place in the day's order, ArrowLeft / ArrowRight
  to the end of the day before or after (never into the past); the focus
  stays on the card and the move is announced in the live region. Dailies
  are fixed rows without controls. In the Questlog column the menu holds the
  board's days, Bearbeiten, Stoppuhr starten, "In Kampagne verschieben …"
  and Löschen; its cards take no arrow keys.
- `components/PlanQuestlog.vue`: the Questlog column (list, drag source,
  menus, collapse toggle); `composables/useMediaQuery.ts` decides whether it
  exists.
- `utils/week-plan.ts`: the pure rules: `dropOnDay` applies a drop to the plan
  at once and says what to write (also for an `incoming` quest from the
  Questlog column), `stepDrop` turns "Nach oben" / "Nach unten" and the arrow keys (also
  left and right, a day) into drops, `arrangeOpen`
  mirrors the server's sorting for the optimistic view, `questlogEntry` shows
  a Questlog quest as a row of the board.
- Writes go through `useWrites` (one at a time, then `notifyDataChanged` and a
  quiet reload). A failed write puts the old plan back at once, shows the
  error and reloads quietly to show what the server kept.
- `useSortable` takes an optional `group` (and `accepts`) so lists trade
  items; it reports the drop's target list and its index among all children.
- `QuickAddQuest` takes `choosePlace: false` for the board: Enter creates the
  quest on that day at the end of its order.
- A phone shows one day at a time (scroll snapping); the current week opens
  scrolled to today (see above). The page itself never scrolls sideways.
