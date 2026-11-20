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
2. Appointments and timed habits by clock.
3. Everything else by `dayPosition`; what was never sorted comes last, oldest
   first, so a new item joins at the end.

The time-based replanner ("Neu planen"), the day-end setting and the per-calendar
"blocks planning" switch are gone: there are no time slots to redistribute.

## Rules

- Moving a todo to another day (PATCH `scheduledDate`, `POST /todos/:id/reschedule`,
  or an edit in Google) resets `dayPosition`: it joins the new day at the end.
- Putting a todo back into the backlog (`scheduledDate: null`) also drops its
  time and puts it at the end of the Questlog's order (below). Clearing only
  the time turns an appointment into a todo of its day.
- An appointment only moves with `confirmFixed`, as before, and keeps its time.
- Completing or skipping does not touch positions.

## API

- `CreateTodoDto` / `UpdateTodoDto`: `scheduledDate` (`YYYY-MM-DD` or null) and
  `timeOfDay` (`HH:mm` or null) replace `scheduledAt` and `isFixed`.
- `TodoResponseDto`, day planner and history items carry `scheduledDate` and
  `timeOfDay`. Day planner items also carry `campaign: { id, title } | null`,
  the topmost todo above the item (see `todo-ancestry.ts`).
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
(`TodosService.nextBacklogPosition`); one that gets a day loses its place.
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
appointment with the event's Berlin day and time. Finished work also goes out,
export only, as Logbuch events (see `logbook.md`).

## Frontend

- `PlanFields.vue`: the day (with "Heute" / "Morgen"); `AppointmentFields.vue`:
  the optional fixed time behind the disclosure "Termin (feste Uhrzeit)", open
  when the quest has one, cleared when the day goes. Every quest form uses
  both; `utils/todo-input.ts` validates them.
- `utils/today-agenda.ts` arranges Heute. `currentItem` is the one rule for
  what is up now, shared by Heute's focus card and the Fokus-Modus: an
  appointment (a todo or habit with a time) from its start until its end, the
  start plus its planned duration or `DEFAULT_APPOINTMENT_MINUTES` (30) without
  one; when several overlap, the one that began last. Otherwise the head of the
  order. Before its start and after its end an appointment sits in Heute's
  list with its time (`appointments`, by clock, before the rest of the order
  and never part of its sorting), with the calendar's events on a phone; it
  never stands in for an empty order (Heute then says "In der Reihenfolge ist
  nichts mehr offen." and names the next appointment). One that is over and
  still open (`past`) asks quietly "Vorbei – erledigt?" with its ring and
  "Anderer Tag …". `nextChangeAt` names the next minute at which this can
  change (a start, an end), and `composables/useDayClock.ts` sets one
  timeout for exactly that minute instead of polling; it catches up when a
  hidden tab becomes visible again. From 64rem the day calendar
  (`DayCalendar.vue`, see `logbook.md`) stands beside the list and shows
  the events there instead.
- The Kalender lists a day's open entries in the same order: `GET /history`
  sorts `days[].planned` with `compareInDay` (`sortedLikeToday` in
  `history-planning.ts`): carried-over first, appointments by clock, then the
  stored `dayPosition`, forecast runs (never sorted) last by title. See
  `history.md`.
- Heute sorts by drag and drop: the focus card and the rows after it are one
  list (`useSortable`, SortableJS), and the whole card drags. A mouse lifts
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
