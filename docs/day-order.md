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
- `PUT /day-planner/events/:id/done` with `{ done: boolean }` ticks a Google
  event off in the app or opens it again (below, Google-Termine abhaken).

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
  order, with the calendar's events at their places among them, see
  "Google-Termine in der Reihenfolge" below). When nothing is up (only appointments are left, none running, and
  the day was never sorted) Heute says "In der Reihenfolge ist nichts mehr
  offen." and names the next appointment. One that is over and
  still open (`past`) asks quietly "Vorbei – erledigt?" in one line below
  its meta; the ring answers it, and "Anderer Tag …" leads its menu
  (`rowMenu` with `otherDay.lead`). A row with its time in the time column
  leaves "Termin" out of its meta line; the column says it. `nextChangeAt` names the next minute at which this can
  change (a start, an end), and `composables/useDayClock.ts` sets one
  timeout for exactly that minute instead of polling; it catches up when a
  hidden tab becomes visible again. From 64rem the day calendar
  (`DayCalendar.vue`, see `logbook.md`) stands beside the list and shows
  the events there too.
- The focus card always heads Heute's list. In the evening (from the
  Monats-Challenge's reminder time, 19:00 without one) today's open run of
  the challenge stands right below it, out of its stored place, until it is
  done or skipped, also one carried over from an earlier day
  (`eveningChallenge`; see `challenges.md` › Heute). The
  stored order is untouched; a drag of the run, or onto it, sorts by what
  is on screen like the focus card, and its menu has no "Nach unten" then.
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
  in clock order. Google events drag too, among the untimed cards, with
  their time fixed (below). Every write sends the whole day. A card passes another once the pointer crosses its
  middle (`swapThreshold` 0.5), so cards of different heights do not jump. A mouse lifts
  it after 6px, a finger only after a 300ms press (`delayOnTouchOnly`), so a
  swipe still scrolls and a short tap still opens the editor; the card's own
  controls never start a drag, except the title: it is the edit button for
  keyboards and screen readers, but a press on the words lifts the card like
  one anywhere else. Once a finger has held long enough, the card rises
  under it (`card-drag--held`: larger, shadow, outline) and the device buzzes
  briefly (`navigator.vibrate`, the app's `VIBRATE` permission), before the
  finger moves; a mouse gets no such sign, it drags as soon as it moves.
  The card under the finger (`.sortable-fallback`) has no transition: it
  follows the finger with every move instead of trailing behind it. The keyboard sorts with "Nach oben" and "Nach
  unten" in the card's menu; the focus stays on its menu button and a status
  line announces the new place. The new order shows at once and is
  confirmed, or taken back, by the reload after the write.
- Moving a single entry sits in its menu "Aktionen für …" (Morgen, Nächste
  Woche, "Anderer Tag …"; an appointment only "Termin verschieben …", where
  the move is confirmed; a past, still open one "Anderer Tag …" first). The quick days run the same step as D and W
  (`utils/row-actions.ts` `quickMoves` decides which days apply).
- `QuickAddQuest.vue`: type a title, press Enter, the quest is planned for
  today, at the end or at the head of the order. Two small toggles beside the
  field, ↑ "Oben einfügen" and ↓ "Unten einfügen" (`aria-pressed`), choose
  which; the choice holds per device for every quick add
  (`composables/useInsertPlace.ts`, `localStorage` `quickAdd:place`). The
  Plan puts one on top of every day.
- "Auf morgen" (the pill before ‹ › in the head) moves everything open to
  tomorrow after asking: today's entries in their order, then what is
  carried over ("Nachholen"); an appointment keeps its time. What cannot
  move stays, and the question names it with its reason
  (`utils/postpone.ts`): a run whose window ends today, an entry whose
  stopwatch runs. Google events are not part of it.
- Creating: below 64rem the floating plus button (`CreateButton.vue`, a long
  press dictates); in the split layout from 64rem, where it would cover the
  rows' ▶, "Neue Quest" in the head opens the same dialog instead, as a
  pill on the ground (`btn--ground`), so the focus card's "Starten" stays
  the one primary action. N still focuses the quick add.
- An empty day says "Für heute ist nichts geplant." A brand-new account (no
  quest and no daily, asked with `GET /todos` and `GET /habits` only while
  the day is empty; a campaign is a quest) gets `TodayWelcome.vue`
  instead: Quest, Daily, Kampagne and Questlog in one sentence each, three
  starters that only fill in a title (a quest the quick add, a daily the
  "Neues Daily" dialog) and "Erste Quest anlegen" (below 64rem; beside the
  calendar "Neue Quest" in the head is that action). A failed question
  keeps the calm line.
- Heute stays alive while another view is shown: `App.vue` wraps the
  `RouterView` in `<KeepAlive include="TodayView">` (only Heute; the
  Fokus-Modus must unmount, its sound stops by design). Coming back from the
  Fokus-Modus or a tab puts the built page back instead of building it
  again, so the cards are there at once, with the pane (Liste · Logbuch),
  open "Nachholen", text in the quick add and the scroll place the router
  keeps. While hidden, Heute rests: `composables/useActive.ts`
  (`whileActive`) stops its data-change listener, day clocks (Heute, Das
  Beste, the day calendar's now line), keys (`useShortcutHandlers`), the
  plus button's scroll listener and the quick add's share of
  `useInsertPlace`; each starts again when Heute is shown. `useLoader`
  then loads quietly once (`onShownAgain`, no skeleton), Heute's data and
  the day calendar's, so a quest completed elsewhere is there after the
  reload; while shown, changes from other devices arrive live
  ([live-sync.md](live-sync.md)). Leaving ends what belongs to the view, as unmounting did: open
  dialogs close (their scroll lock with them), an open "…" menu and a
  Logbuch drag end, dictation in the quick add stops, the campaign
  question says no, a held undo goes through and old notices go.

### Andere Tage

‹ › in Heute's head leaf through the days; "Heute" beside them leads back.
The day lives only in the address (`#/heute?tag=YYYY-MM-DD`, replaced, not
pushed), so the tab bar always opens today. Another day
(`TodayOtherDay.vue`) reads the Plan's endpoint for that one day
(`GET /day-planner/plan?from=…&days=1`), so it follows the Plan's rules: a
past day lists what was done and skipped, a later day what is planned,
with the runs the schedule forecasts. Its entries wear Heute's cards
(`utils/other-day.ts` `asPlannerItem`), above them the relation
("Gestern", "Morgen", "in 3 Tagen") and the day counted as every view
counts one.

- A later day takes quests in its quick add, sorts its open quests and
  stored runs by dragging (the Plan's `dropOnDay` / `dropRunOnDay`) and
  moves them with the quick moves of their menu. Quests tick; runs only
  tick on their own day.
- Its Google events are entries of the Plan's day, at their places; on a
  later day they drag like on today (the Plan's `dropEventOnDay`).
- A run the schedule only forecasts (`isForecast`: no occurrence stored
  yet) shows as planned, not there: no ring, no fill, a dashed edge, here
  and in the Plan. See "Vorhergesagte Läufe" below.
- A past day shows its reflection and its best below the list.
- No focus card, no stopwatch, no "Nachholen", no "Alles Offene auf morgen" there:
  they belong to now. The Logbuch pane shows that day's calendar; on a day
  after today the pane is called "Termine", as the calendar calls itself
  there.
- A tap opens the same editor as on today.

### Vorhergesagte Läufe

A habit has one open run at a time (`UQ_habit_occurrences_pending`), so a
daily's run on a later day is not stored before its day; the Plan forecasts
it from the schedule. It still takes a place in that day's order:

- It drags within its day like a card (`data-forecast-id`, `boardDrop`
  kind `forecast`, `dropForecastOnDay`) and is written as
  `{ type: "forecast", id: habitId, date }` among the day's items
  (`PUT /day-planner/order`).
- `habit_forecast_places` (habit, day, position) keeps the place; the Plan
  sorts the forecast by it (`plannedHabitCandidate`).
- When its day comes and the run is stored (`reconcile`), the run takes the
  place over as its `dayPosition`, and the habit's places up to today go.
- It never moves to another day: dropped there, or on "Heute" in the head,
  it stays and says so ("… ist erst eingeplant und bleibt an seinem Tag.").

### Ablegen auf "Auf morgen" und "Heute"

‹ › close Heute's head on every day, in the same place. Before them stands
one pill: on today "Auf morgen" (everything open after asking), on
another day "Heute" (back). The pill is a drop target (`data-day-drop`
with the day in `data-date`): a card dragged onto it and released there
moves to that day, without a question. The rule is `useSortable`'s `dropTarget`, shared by every list
that sorts by dragging: while a card is dragged the pointer is followed
(the drag layer lets it through), the target under it is marked
(`drop-target--over`), and on release the card goes back to its place in
the list and `onDrop` runs instead of `onMove`.

- A quest moves at once, an appointment with its time (`confirmFixed`;
  the menu's "Termin verschieben …" still asks); a run takes only a day
  of its window (`runMayMoveTo` on other days). A line above the list
  says where it went.
- What a target does not take does not light up but fades
  (`drop-target--refused`), and on release it says why (`onRefuse`, words in `utils/day-drop.ts`): a Google event stays on
  its day, a run outside its window names where its window ends.

### Google-Termine abhaken

A Google event in Heute's list and on its other days has a ring. Ticked
off, it leaves the open list for "abgeschlossen" (crossed out), the day
calendar on the side keeps it, and it counts in no tally; the same ring
opens it again there. Only by hand: an event that is over is only shown
quieter.

- `external_events.doneAt` holds the tick, only the app's: nothing is
  written to Google. A sync carries it over by `eventId` like the place
  (`replaceExternal`).
- `GET /day-planner/today` sends `done` per event; the Plan's entries say
  `status: "completed"` and stand among the day's done entries.
- The frontend shows the tick at once and writes it after
  (`useEventTick`, the same in Heute and on its other days); a failure
  takes it back. An id a sync has replaced meanwhile answers 404, and the
  view loads the day again.

### Google-Termine in der Reihenfolge

Events from the person's other Google calendars are read only
(`calendar.events.readonly`); the app never writes there. Everywhere a day
is sorted (Heute, its other days, the Plan) they still stand in the order
of the day like an appointment: at their start on the clock among the
timed items, and between those wherever the person put them or the quests
around them. Their time and day never change.

- `external_events.dayPosition` holds the place, counted like the items'
  (`PUT /day-planner/order` takes `{ type: "event", id }` among the
  items). A sync replaces the rows, so `eventId` (the event's id in its
  calendar) carries the place over (`replaceExternal`). An event id a sync
  has replaced meanwhile is skipped; its place stays a gap.
- `GET /day-planner/plan` puts them among each day's entries
  (`type: "event"`, `eventCandidates`), sorted by the one rule
  (`sortInDay`); one that began the day before stands at 00:00 there.
- `GET /day-planner/today` sends each event's `dayPosition`. Heute joins
  them into the server's order (`withAnchors` in `utils/day-order.ts`):
  on the clock among the timed items and, between them, before the first
  item stored after it; one never sorted right after the appointment
  before it, or at the head of the day.
- An event counts as a row: a card dropped right after it stays after it,
  and the event itself drags among the untimed cards, stopping at the
  appointments and events before and after it on the clock
  (`clockBoundIndex`, in `dropInDay` on Heute and `dropEventOnDay` on the
  Plan's days). It opens no editor and counts in no tally. The keyboard's
  "Nach oben" / "Nach unten" step over events; they have no menu.

## Migration

`1794960000000-DayOrder` adds the columns, converts existing rows (a fixed todo
keeps its Berlin wall clock as `timeOfDay`, a flexible one only its Berlin day)
and drops `scheduledAt`, `isFixed`, `users.dayEndMinutes`,
`external_calendars.blocksPlanning` and `external_events.busy`. The migration
test starts from the baseline schema with data and checks the conversion.

`1796700000000-EventPlaces` adds `external_events.eventId` and
`dayPosition`; rows from before get their id at the next sync.
