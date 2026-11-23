# Planning a day: its day, an order, and appointments

## Model

Planning works by day and order, not by clock time.

- A planned todo has **its day** (`todos.scheduledDate`, a calendar day in
  Europe/Berlin). Without one it is in the backlog (the Questlog).
- Only an **appointment** also has a time (`todos.timeOfDay`, `HH:mm`). There is
  no separate "fixed" flag: fixed means "has a time". A database check keeps a
  time from existing without a day.
- Everything else on a day is worked through in **the order of the day**
  (`dayPosition` on `todos` and `habit_occurrences`). Todos and habit
  occurrences share one order.

`backend/src/todos/todo-agenda.ts` stays the one definition of planned,
overdue, completed-on-a-day and backlog; `backend/src/day-planner/day-order.ts`
is the one sorting rule:

1. Earlier day first (carried-over items).
2. Within a day one sequence by `dayPosition` (`sortInDay`); what was never
   sorted comes last, oldest first, so a new item joins at the end.
3. Appointments and timed habits are **anchors** in that sequence: they
   stand at their stored place, so an item can be sorted between two of
   them, but among each other they always follow the clock (one stored
   before an earlier one moves down to it). One never sorted stands right
   after the appointment before it on the clock, or at the head of the day.
   Any change of a todo's time resets its place: a new time anchors it
   anew right after the appointment before it on the clock, a cleared time
   sends it to the end of its day. A daily's new time does the same for its
   open runs (`HabitsService.update` clears their `dayPosition`). Migration
   `1796200000000-AnchoredAppointments` cleared the places timed todos
   carried from before, when they meant nothing; habit runs kept theirs.

The time-based replanner ("Neu planen"), the day-end setting and the per-calendar
"blocks planning" switch are gone: there are no time slots to redistribute.

## Rules

- Moving a todo to another day (PATCH `scheduledDate`, `POST /todos/:id/reschedule`,
  or an edit in Google) resets `dayPosition`: a todo without a time joins
  the new day at the end, an appointment stands right after the appointment
  before it on the clock.
- Putting a todo back into the backlog (`scheduledDate: null`) also drops its
  time and puts it at the end of the Questlog's order (below). Clearing only
  the time turns an appointment into a todo of its day, at the end of it.
- An appointment only moves with `confirmFixed`, as before, and keeps its time.
- Completing or skipping does not touch positions.
- One module applies these rules to a todo: `saveQuest` in
  `backend/src/todos/quest-commands.ts` (day, time, completion; it ends the
  stopwatch of a completed quest in the same transaction). `TodosService`
  and the Google sync both go through it. Daily runs move and change status
  through `HabitSchedulingService.moveRun` / `setRunStatus`, which lock the
  habit, reconcile its runs and end a resolved run's stopwatch; the Google
  sync moves runs through `moveRun` too.

## API

- `CreateTodoDto` / `UpdateTodoDto`: `scheduledDate` (`YYYY-MM-DD` or null) and
  `timeOfDay` (`HH:mm` or null) replace `scheduledAt` and `isFixed`.
- `TodoResponseDto`, day planner and history items carry `scheduledDate` and
  `timeOfDay`. Day planner items also carry `campaign: { id, title } | null`,
  the topmost todo above the item (see `todo-ancestry.ts`). Heute and the Kalender label their
  entries (category, effective reason, campaign) through one module,
  `day-planner/agenda-context.ts`.
- `PUT /day-planner/order` with `{ items: [{ type: "todo" | "habit", id }] }`
  stores an order: each item takes its index as position. A habit's `id` is its
  occurrence id. All items must be the caller's own, otherwise 404 and nothing
  is written. It runs in the per-user unit of work. It orders any day, not only
  today: a position only counts among the items of the day an item is on. The
  Plan (`week-plan.md`) sorts every day of its board through it.
- `GET /day-planner/plan?from=<day>&days=<1–31>` answers the Plan's days in
  this order, with what is overdue apart; see `week-plan.md`.
- `PUT /todos/backlog/order` with `{ ids: number[] }` stores the Questlog's
  order (below).

## The Questlog's order

The backlog keeps an order of its own: `todos.backlogPosition` (nullable
integer, migration `1795800000000-BacklogOrder`, which numbers every todo
without a day by creation). A todo that enters the backlog, by being created
without a day or by losing its day, takes the place after the last one
(`nextBacklogPosition` in `todos/quest-commands.ts`); one that gets a day
loses its place, also when the day comes from Google.
`POST /todos` without a day takes `backlogPlace: 'top' | 'bottom'`
(default `bottom`): `top` puts the new quest before the first one
(`firstBacklogPosition`, the lowest position minus one, so positions may
go below zero), in the same transaction as the insert. The quick add of the
Questlog view and of the Plan's Questlog column sends it from the shared
↑ / ↓ choice; with a day the field is ignored.
`backlogTodos` lists by `backlogPosition` (nulls last), then creation, so
the Questlog view and the Plan's Questlog column show the same order. A todo
the Google sync puts back into the backlog has no place yet and follows.

`PUT /todos/backlog/order` takes ids of the caller's Questlog (the workable
backlog of `backlogTodos`) and stores them first, in that order, followed by
the rest of the Questlog in the order it had; every id must be in the
caller's Questlog and appear once (404 / 400, nothing is written). It runs
in the per-user unit of work. The Questlog view sorts by dragging the whole
card (`useSortable`, a finger after a long press) and by "Nach oben" /
"Nach unten" in each card's menu, the focus staying on its menu button; the
new order shows at once and a failed write takes it back.

## Google Calendar

Of the plan, only appointments are written to the app's own Google calendar.
A todo that loses its time loses its event; an event deleted in Google puts the
todo back into the backlog. A new event in the app's calendar becomes an
appointment with the event's Berlin day and time.

An edit in Google that moves an appointment goes through `saveQuest` like a
move in the app, but on purpose without the checks of
`POST /todos/:id/reschedule` (past day, `confirmFixed`, open stopwatch):
Google already shows the new time, so it wins as `PATCH /todos/:id` does.
A completed quest is left alone. An edit that moves a daily run is taken
only where `POST /habit-occurrences/:id/reschedule` would take it
(`moveRun`: an open run of the active version of an active habit, within
its window, no open stopwatch); otherwise the run stays and the next sync
writes the event back to it. Finished work also goes out,
export only, as Logbuch events (see `logbook.md`).

## Frontend

- `PlanFields.vue`: the day (with "Heute" / "Morgen"); `AppointmentFields.vue`:
  the optional fixed time behind the disclosure "Termin (feste Uhrzeit)", open
  when the quest has one, cleared when the day goes. Every quest form uses
  both; `utils/todo-input.ts` validates them.
- `utils/today-agenda.ts` arranges Heute. `currentItem` is the one rule for
  what is up now, shared by Heute's focus card and the Fokus-Modus. Once the
  day has a saved order (an open item carries a `dayPosition`), its first
  open item in that order is the focus, an appointment too, even one that
  has not started yet. Before the day is sorted the clock decides: an
  appointment (a todo or habit with a time) from its start until its end, the
  start plus its planned duration or `DEFAULT_APPOINTMENT_MINUTES` (30) without
  one; when several overlap, the one that began last. Otherwise the first
  item without a time in the order. Every other appointment sits in Heute's
  list with its time, anchored in the order of the day (`list`, the server's
  order, with the calendar's events by clock among the appointments on a
  phone). When nothing is up (only appointments are left, none running, and
  the day was never sorted) Heute says "In der Reihenfolge ist nichts mehr
  offen." and names the next appointment. One that is over and
  still open (`past`) asks quietly "Vorbei – erledigt?" with its ring and
  "Anderer Tag …". `nextChangeAt` names the next minute at which this can
  change (a start, an end), and `composables/useDayClock.ts` sets one
  timeout for exactly that minute instead of polling; it catches up when a
  hidden tab becomes visible again. From 64rem the day calendar
  (`DayCalendar.vue`, see `logbook.md`) stands beside the list and shows
  the events there instead.
- The Kalender lists a day's open entries in the same order: `GET /history`
  sorts `days[].planned` with `sortInDay` (`sortedLikeToday` in
  `history-planning.ts`): carried-over first, then the stored order with the
  appointments anchored in it; forecast runs are never sorted, so untimed
  ones come last by title and timed ones stand right after the appointment
  before them on the clock. See
  `history.md`.
- Heute sorts by drag and drop: the focus card and the rows after it are one
  list (`useSortable`, SortableJS). Quests, stored runs and appointments drag.
  Timed cards can cross flexible cards and stop at the adjacent appointment
  in clock order. Google events are read-only. Every write sends the whole day. A card passes another once the pointer crosses its
  middle (`swapThreshold` 0.5), so cards of different heights do not jump. A mouse lifts
  it after 6px, a finger only after a 300ms press (`delayOnTouchOnly`), so a
  swipe still scrolls and a short tap still opens the editor; the card's own
  controls never start a drag. The keyboard sorts with "Nach oben" and "Nach
  unten" in the card's menu; the focus stays on its menu button and a status
  line announces the new place. The new order shows at once and is
  confirmed, or taken back, by the reload after the write.
- Moving a single entry sits in its menu "Aktionen für …" (Morgen, Nächste
  Woche, "Anderer Tag …"; an appointment only "Termin verschieben …", where
  the move is confirmed). The quick days run the same step as D and W
  (`utils/row-actions.ts` `quickMoves` decides which days apply).
- `QuickAddQuest.vue`: type a title, press Enter, the quest is planned for
  today, at the end or at the head of the order. Two small toggles beside the
  field, ↑ "Oben einfügen" and ↓ "Unten einfügen" (`aria-pressed`), choose
  which; the choice holds per device for every quick add
  (`composables/useInsertPlace.ts`, `localStorage` `quickAdd:place`). The
  Plan puts one on top of every day.
- "Auf morgen" moves everything open that only has its day to tomorrow, after
  asking. Appointments and dailies that cannot move stay.

## Migration

`1794960000000-DayOrder` adds the columns, converts existing rows (a fixed todo
keeps its Berlin wall clock as `timeOfDay`, a flexible one only its Berlin day)
and drops `scheduledAt`, `isFixed`, `users.dayEndMinutes`,
`external_calendars.blocksPlanning` and `external_events.busy`. The migration
test starts from the baseline schema with data and checks the conversion.
