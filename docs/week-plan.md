# The plan board (Plan)

A board that starts with today, to plan the next days the way Heute plans
one. From left to right: the Questlog, what was left behind ("Liegen
geblieben", only when there is something), today, then as many following
days as fit the window. There are no past days and no fixed weeks. The board
reads and writes the same model as Heute (see `day-order.md`): a todo has
its day, an appointment also a time, and everything else follows the order
of its day. In code the feature keeps its earlier name, the week plan
(`week-plan.ts`, `WeekPlan*` types).

## Read: `GET /day-planner/plan?from=YYYY-MM-DD&days=N`

`days` columns from `from`, any weekday, `days` from 1 to 31
(`week-plan.ts` `planDates`, `MAX_PLAN_DAYS`; anything else is 400, as is a
malformed or out-of-range date or an unknown query field). The board only
asks from today on, but a past day would just show what was done. First it
reconciles the user's active habits the way Heute does
(`HabitSchedulingService.reconcileAll`: under the user lock only when a run
is missing or ran out), so today's runs are stored and the board can sort,
move and open them; then the answer is one `REPEATABLE READ`
snapshot that writes nothing:

```ts
{ startDate, endDate, today, days: [{ date, entries: WeekPlanEntry[] }], overdue: WeekPlanEntry[] }
```

Each day lists its open entries in the order of the day, then the resolved
ones in that same order (`arrangePlan`, sorting with `day-order.ts`
`sortInDay`; appointments are anchors and take part in a day's
written order, so a quest can be dropped between two of them). An entry is a todo (`todoId`, `status`, `scheduledDate`) or a
habit run (`habitId`, `occurrenceId`, `status`, `moveUntil`, the last
day an open stored run may move to, `timerEligible` and `streak`, see
`streaks.md`), both with `title`, `timeOfDay`, `plannedDurationMinutes`,
`campaign` (`todo-ancestry.ts`) and `isOverdue`.

Where things show up, built from the existing definitions instead of a second
projection:

- **Open todos** follow the todo agenda (`todo-agenda.ts`): on their day.
- **Overdue** (`overdue`) is what Heute offers under Nachholen, whatever days
  were asked for: open todos planned before today (`overdueTodos`, the rule
  of `placeOpenTodo`) and open runs the forecast carries to today from an
  earlier slot (`isOverdue` of `plannedHabits`). Earliest day first, then the
  order they had. They never stand on today's column.
- **Completed todos** sit on the day they were completed (`completedTodos`).
- **Open habit runs** come from the forecast history uses
  (`history/habit-forecast.ts` → `history-planning.ts` `plannedHabits`): a
  stored pending run where it exists, otherwise a run the schedule forecasts,
  with `occurrenceId: null`. Today's runs are stored by the reconciliation
  before the read, so only later days hold forecasts. Today is always part of
  the forecast, so its carried-over runs are found even when the board starts
  later. A forecast has no stored position. A timed forecast follows the
  preceding appointment on the clock, or heads the day if there is none.
  An untimed forecast follows the stored entries. Weekly-target dailies have no day of their own and are
  not shown, except today's stored run (`openTargetRuns`), as in the
  calendar.
- **Resolved runs** (`resolvedOccurrences`): a completed one on the day it
  was done, a skipped one on its due day.

Every query is scoped to the user; occurrences through their habit.

## Write: the existing paths

- **Within a day** it stores the day's order with `PUT /day-planner/order`.
  That endpoint was never tied to today: a position only counts among the
  items of the day an item is on, so it orders any day.
- **To another day** it moves the quest with `POST /todos/:id/reschedule`
  (which resets its position, see `day-order.md`) and then stores the target
  day's order, so the quest lands where it was dropped. An appointment is
  moved with `confirmFixed` (the drag is the confirmation), keeps its time
  and takes part in the target day's order. A quest left behind moves the same way.
- **A daily's stored run** sorts within its day with the same order
  endpoint and moves to another day with `POST /habit-occurrences/:id/reschedule`
  (Heute's "Morgen" and "Anderer Tag …"), then the target day's order is
  stored. It only moves within its window, from today to `moveUntil`
  (`utils/week-plan.ts` `runMayMoveTo`, the server checks the same); a drop
  beyond it stays where it was and the board says how far it may wait. A
  forecast run has nothing stored and does not drag.
- The past takes no drops, and reschedule refuses past days anyway.
- The day's order sent to the server holds every open quest and stored habit run,
  including appointments. Forecast runs have no occurrence ID to send
  (`utils/week-plan.ts` `dayOrder`).
- **From the Questlog column** a quest has no day yet, and `reschedule`
  refuses quests without one. It is planned with the Questlog editor's own
  save (`PATCH /todos/:id` with title, day, no time and its duration;
  `api/questlog.api.ts` `planQuest`, which the Questlog and its T/D/W use
  too), then the target day's order is stored.
- **Into the Questlog column** a quest from a day (or one left behind) loses
  its day (`PATCH /todos/:id` with `scheduledDate: null`, `unplanQuest`;
  an appointment loses its time with it), then the column's whole order is
  stored with `PUT /todos/backlog/order`, so it lands where it was dropped.
  Sorting inside the column only stores that order (see `day-order.md` ›
  The Questlog's order).

## The columns

- **Questlog** (`PlanQuestlog.vue`), always at the far left, also on a
  phone: the open quests without a day that one can work on, in the
  Questlog's own order (`GET /todos/backlog`: no campaigns, no Questreihen
  with open quests, see `todo-hierarchy.md`; each names its `campaign`, so
  the column draws the stripe). Its list is part of the board's SortableJS
  group in both directions. Collapsed it is a rail as wide as its toggle
  (2.75rem) with the count. Without a choice it opens when the board's
  frame fits the open column and one day (at least 12 + 0.5 + 14 = 26.5rem;
  before the frame is measured, from 56rem), and otherwise starts collapsed
  (`questlogStartsOpen`); toggling stores the explicit
  choice per device in `localStorage` (`plan:questlog` = `open` or
  `closed`), which then wins at any width. When the board has to scroll
  sideways the column is sticky at the left edge, on an opaque ground.
- **Liegen geblieben** (`PlanOverdue.vue`), only when `overdue` has
  entries. Open it is a day column of 14rem; its chevron toggle
  ("Liegen geblieben ausblenden" / "einblenden") folds it to a 2.75rem rail
  with the title running vertically. Open by default; the choice is stored
  per device in `localStorage` (`plan:overdue` = `open` or `closed`), like
  the Questlog's. Its quests drag onto
  a day or into the Questlog column and move through their menu (Heute,
  Morgen, Nächste Woche, Anderer Tag …); its runs drag onto a day of their
  window and move through Heute's menu. They take no arrow keys and the
  column takes no drops and keeps its order.
- **Days** (`PlanDay.vue`): today with the calendar's ink frame, then the
  following days.

## How many days, and the address

The view measures its frame with a `ResizeObserver` and counts how many day
columns of at least 14rem fit beside the Questlog column (12rem open,
2.75rem as a rail) and, when there is one, the column of what was left
behind (14rem open, 2.75rem folded, so folding it frees room for days),
with 0.5rem gaps (`utils/week-plan.ts` `fittingDays`, `BOARD`). The
columns share the rest of the width (`boardColumns`: `minmax(14rem, 1fr)`).
At least one day shows, from 56rem at least two; where even that does not
fit, the board scrolls sideways inside itself (never the page) and opens so
that today stands right beside the sticky Questlog column (`todayScroll`).
The page is up to 120rem wide. One read loads 14 days (more if more fit), so
a resize rarely loads again; what is shown is the first `fittingDays` of
them. Without layout (tests) it shows seven.

The address keeps the first day shown: `#/plan` is today, `#/plan?ab=<day>`
a later one (`firstDayFromQuery`; a past or unusable day means today).
"Vorige Tage" and "Nächste Tage" step by the number of days shown, never
before today (`shiftedStart`; "Vorige Tage" is disabled at today). "Heute"
stands before the arrows and shows only away from today (The Way-Back Rule);
after it the focus goes to the heading, which names the range
(`rangeLabel`, "20.–23. Nov."). An old link with `?woche=<Monday>` is
redirected by the router to the first day of that week still ahead
(`planQueryFromWeek`): the current or a past week opens on today.

## Cards and keys

- `components/PlanEntry.vue`: a compact card. A quest's title, or a tap
  anywhere else on it, opens `EditItemDialog`; the whole card drags; its
  menu (`rowMenu` from the actions `PlanView` gives the card) holds Morgen / Nächste Woche,
  "Anderer Tag …" (`MoveItemDialog`), Bearbeiten, Stoppuhr starten (a
  compact card has no ▶), "In Kampagne verschieben …"
  (`CampaignMoveDialog`), Nach oben / Nach unten in the day and Löschen
  (`DeleteItemDialog`, the editor's confirmation). With the focus on a
  quest's card (its title button), the arrow keys move it like dragging:
  ArrowUp / ArrowDown one place in the day's order, ArrowLeft / ArrowRight
  to the end of the day before or after among the days shown (never into
  the past; an appointment goes to the end only as far as the clock allows,
  before the first appointment later than it, `clockBoundIndex`); the focus stays on the card and the move is announced in the
  live region. A daily's run is a card like a quest's: a tap opens the
  daily's editor with the notes of this run (`EditItemDialog` with
  `occurrenceId`), a stored open run drags and takes the arrow keys within
  its window, and its menu holds what Heute's does: the quick moves its
  window allows, "Anderer Tag …", Überspringen (once due), Bearbeiten,
  Stoppuhr starten, Nach oben / Nach unten and Löschen of the whole daily;
  X ticks it with the undo toast once it is due, Space measures it, T, D and
  W move it like its menu. A forecast run only opens its daily, and its menu
  holds Bearbeiten and Löschen. Its details name a running series ("4 in
  Folge"). In the Questlog
  column the menu holds the days shown, Bearbeiten, Stoppuhr starten,
  "In Kampagne verschieben …", Nach oben / Nach unten in the Questlog and
  Löschen; its cards take no arrow keys. T, D and W on a column row plan it
  (beyond the board with the editor's save alone), X ticks it with the undo
  toast and Space runs its stopwatch.
- The Questlog column starts with the same quick add without a day: Enter
  puts the quest at the head or the end of the Questlog's order
  (`backlogPlace`, see `day-order.md`).
- Each day starts with its quick add (`QuickAddQuest`) above the cards:
  Enter plans the quest on that day, at the end of its order, or at its head
  while ↑ ("Oben einfügen") is pressed. The two small toggles ↑ / ↓ are one
  choice per device for every quick add, Heute's too
  (`composables/useInsertPlace.ts`, `localStorage` `quickAdd:place`). The
  Plan shows them once, in its head before the day arrows
  (`InsertPlaceToggle`), with the visible word "Neue" before them and a
  thin rule after them, so they never read as part of the day navigation; its columns' quick adds hide their own
  (`placeToggle: false`) and keep the full width for the field.

## Widths and wrapping

- A day column has slim side padding (0.375rem); an entry gives its title
  the full width and puts its menu "…" below it (beside the details, if any).
  From a 15rem entry the menu sits beside title and details again. Below an
  8.25rem entry the title is 0.875rem instead of 0.9375rem.
- Titles wrap between words (`overflow-wrap: break-word`); only a word
  longer than the whole line breaks inside. `hyphens: auto` (words of ten
  characters and more) helps where the platform has a German dictionary, but
  the widths never rely on it. A title is clamped to three lines; its tooltip
  and accessible names keep it whole. The campaign's chip has its own line
  and ends in an ellipsis in narrow columns.
- The quick add's placeholder is "Quest hinzufügen …" where it fits and
  "Hinzufügen …" where not, measured against the field (`utils/fit-text.ts`,
  re-measured on resize and once the web font is in).
- The loading bones take the board's columns and are clipped, never scrolled.

## Frontend

- `views/PlanView.vue` (`#/plan`, `?ab=<first day>`): the range as heading,
  "Heute" and the arrows, loading skeleton, load error with retry, a lead
  when nothing is planned on the days shown and nothing was left behind.
- `utils/plan-move.ts`: "move this entry there" as one pure rule.
  `boardDrop` reads where a drag ended from the card (`data-todo-id`,
  `data-run-id`, `data-event-id`, `data-forecast-id`) and the list's
  `data-date` / `data-questlog`; `planMove` says what any such move means,
  by kind (a quest from a day, left behind or from the Questlog column; a
  stored run within its window; an event or forecast within its day; a
  quest into the Questlog column): the plan (and column) as shown at once,
  the writes in their order, the status line and the error text, or why it
  may not land. `stepDrop` turns "Nach oben" / "Nach unten" and the arrow
  keys into the same moves.
- `utils/week-plan.ts`: the board's read and layout: which entries move
  (`isMovable`, `isMovableRun`), `arrangeOpen` mirroring the server's
  sorting for the optimistic view, plus the column and address rules above.
- `composables/usePlanMove.ts` sends a move for the Plan and Heute's other
  days alike, through `useWrites` (one at a time, then `notifyDataChanged`
  and a quiet reload). A failed write puts the old plan (and column) back
  at once, shows the error and reloads quietly to show what the server kept.
- `useSortable` takes an optional `group` (and `accepts`, and `sort: false`
  for a list whose items only leave it) so lists trade items; it reports
  the drop's target list and its index among all children.
- Google events are entries of their days (`type: "event"`, see
  day-order.md › Google-Termine in der Reihenfolge). They drag within their
  own day from today on (`data-event-id`, `planMove`, written by the
  shared `usePlanMove`), never to another day, open no editor and do not
  count in a day's summary.
