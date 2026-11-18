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
  time. Clearing only the time turns an appointment into a todo of its day.
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
  week plan (`week-plan.md`) sorts every day of its board through it.
- `GET /day-planner/week?start=<Monday>` answers a whole week in this order;
  see `week-plan.md`.

## Google Calendar

Of the plan, only appointments are written to the app's own Google calendar.
A todo that loses its time loses its event; an event deleted in Google puts the
todo back into the backlog. A new event in the app's calendar becomes an
appointment with the event's Berlin day and time. Finished work also goes out,
export only, as Logbuch events (see `logbook.md`).

## Frontend

- `PlanFields.vue`: the day (with "Heute" / "Morgen") and an optional fixed time,
  used by every quest form. `utils/todo-input.ts` validates them.
- `utils/today-agenda.ts` arranges Heute: the focus is the head of the order,
  unless an appointment is running right now (its time until its duration, or
  30 minutes); appointments and calendar events sit on the time axis.
- Heute sorts by drag and drop: the focus card and the rows after it are one
  list (`useSortable`, SortableJS). The grip (in a row's time column, at the
  focus card's top right) also takes Arrow Up/Down, and a status line
  announces the new place. The new order shows at once and is confirmed, or
  taken back, by the reload after the write.
- Moving a single entry sits in its menu "Aktionen für …" (Morgen, Nächste
  Woche, "Anderer Tag …"; an appointment only "Termin verschieben …", where
  the move is confirmed). The quick days run the same step as D and W
  (`utils/row-actions.ts` `quickMoves` decides which days apply).
- `QuickAddQuest.vue`: type a title, press Enter, the quest is planned for
  today, at the end or at the head of the order. The week plan uses it per day,
  always at the end.
- "Auf morgen" moves everything open that only has its day to tomorrow, after
  asking. Appointments and dailies that cannot move stay.

## Migration

`1794960000000-DayOrder` adds the columns, converts existing rows (a fixed todo
keeps its Berlin wall clock as `timeOfDay`, a flexible one only its Berlin day)
and drops `scheduledAt`, `isFixed`, `users.dayEndMinutes`,
`external_calendars.blocksPlanning` and `external_events.busy`. The migration
test starts from the baseline schema with data and checks the conversion.
