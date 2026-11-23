# Synced stopwatch and Todo completion

## Scope

One running **or paused** stopwatch per signed-in user, shared by all devices.
It counts up, starting from the time already logged for its target (see
"Starting from logged time"). The planned minutes of its target are an optional
**target**: the moment it is reached is recorded and notified once, and the
stopwatch runs on. Nothing is completed automatically.

## UI

- Every open Todo and every due Habit occurrence has a round Play icon; a planned
  duration is not needed. Future and paused Habits cannot start an occurrence.
- The UI always says "Stoppuhr", never "Timer" (labels, screen-reader names,
  menus, the command menu, Einstellungen, server messages, push). `timer` stays
  the name in code, API and database. The target is the "Soll": it is reached,
  nothing "runs out" (Einstellungen: "Benachrichtigen, wenn das Soll erreicht
  ist"; the push says "Du hast dein Soll erreicht", "Die Stoppuhr läuft
  weiter.").
- A sticky bar ("Aktuelle Stoppuhr") stays visible across the views: time
  worked, "von n Min." when there is a target, and round 44px controls:
  pause/resume, change target, complete, end. The label reads "Stoppuhr läuft",
  "Pausiert" or "Soll erreicht".
- **Soll reached**: when the running stopwatch reaches its Soll while a page is
  open, `useTargetNotice` (`frontend/src/composables/useTargetNotice.ts`,
  mounted once in `TimerProvider.vue`) shows a `NoticeToast` on every view, the
  Fokus-Modus included: "Soll erreicht: <Titel> · <Soll>. Die Stoppuhr läuft
  weiter." It stays ten seconds or until "OK"; the bar's status line says the
  same. Only a reach seen happening counts, once per stopwatch and Soll: not a
  stopwatch already past its Soll when it appears (started again, page opened
  later) and not a Soll lowered below the time worked. With notification
  permission it also shows a system notification (see `timer-push.md` for the
  dedupe with Web Push); permission "default" is never prompted for here.
- Completing by a ring offers the undo toast everywhere (Heute, Questlog, Plan,
  Kalender, Kampagnen, Dailies); a campaign with open quests asks first (see
  `todo-hierarchy.md`). The bar's "Erledigen" and the Fokus-Modus' "Erledigt"
  have no toast: the stopwatch ends with it and the next quest follows.
- Daily runs are completed through `PATCH /habit-occurrences/:id/status`
  wherever they have a ring: Heute, Kalender › Tag (today's runs; a forecast
  run first looks up its stored occurrence via `GET /habit-occurrences/today`)
  and the Dailies view (today's run: the pending `timerOccurrenceId`, or the
  run the week lists as completed today, which the ring opens again). Undo
  sets the run back to `pending`. There is no second completion path.
- Ending needs no confirmation: every stretch is in the logbook already.
  Switching to another target still asks, and checks the exact old timer ID, so a
  stale device cannot end a newer stopwatch.
- The target can be changed while running or paused. The time worked stays; only
  the moment the target is reached moves. It is stored on the Todo or **only on
  that Habit occurrence**, never on the Habit default.
- Completing/deleting the linked Todo, pausing/deleting the Habit, or resolving its
  occurrence ends the stopwatch in the same transaction (`releaseTimers` in
  `backend/src/timers/timer-target.ts`, called by `saveQuest` in
  `todos/quest-commands.ts` and by the run and habit commands of
  `HabitSchedulingService`).
- **Fokus-Modus** (`#/fokus`, `FocusView.vue`): one quest in view with its campaign,
  its why and the stopwatch large; no navigation and no timer bar. What the
  stopwatch runs on stays in view; otherwise `currentItem` decides, the rule of
  Heute's focus card (`docs/day-order.md`): an appointment from its start until
  its end (planned duration, or 30 minutes), else the head of the day's order.
  The view switches by itself at those moments. An appointment shows its time
  range ("Termin 10:00–10:30") and has no "Später"; Heute's focus card leaves
  out the link to the Fokus-Modus while an appointment is on it. With an empty
  order and an appointment still to come, it says "Nichts in der Reihenfolge"
  and names the next appointment instead of "Alles erledigt". The primary
  button reads "Starten" (▶), "Pausieren" (⏸) or "Fortsetzen" (▶). Nothing
  previews the next quest. A fixed appointment (quest, timed daily or calendar
  event) is named only from 15 minutes before it starts ("Gleich um 15:30:
  Zahnarzt", `soonAppointment` in `utils/today-agenda.ts`; the view's clock
  also wakes at that moment); while the stopwatch holds another quest past an
  appointment's start, it says "Seit 15:30: Zahnarzt", and the appointment
  comes into view as soon as that quest is done or put back. "Erledigt" brings
  up the next one, "Später" puts the quest behind the rest of the order and
  ends its stopwatch. Space starts/pauses, Ctrl+Enter completes, Escape leads
  back to Heute. Campaign and Warum show when present, for a daily run its
  own campaign or its goal's and its effective Warum. A quest shows its notes
  below the actions, a daily run the notes of that run (see `quest-notes.md`);
  while typing there, Space writes a space and the first Escape only leaves
  the text.

## Time, devices and forgotten stopwatches

PostgreSQL stores the time of all finished stretches (`elapsedMilliseconds`) and
the start of the running one (`segmentStartedAt`). The time worked is derived from
these instants (`timer-math.ts`), never from a counter that ticks, so a locked
phone or a restarted server cannot make it drift. The browser counts on from the
server's answer on a monotonic clock.

Every stretch is logged as work when it ends (pause, end, completion); the
calendar shows the logs as the Logbuch (see `logbook.md`). A stretch
that nobody ends counts for at most **twelve hours**: the next read cuts it there
and leaves the stopwatch paused, so a stopwatch forgotten overnight does not turn
into work that never happened.

### Blocks: short pauses and short stretches

The stopwatch logs **blocks**, not every stretch. The rules are one pure
function, `transition(state, event, now) → { state, logOps }` in
`backend/src/timers/timer-transition.ts` (events `pause`, `stop`, `resume`;
constants `BLOCK_GAP_MS` and `MIN_BLOCK_MS`, both 60 seconds), tested in
`timer-transition.spec.ts`. `recordTransition` in `timer-target.ts` is its
adapter: it reads the block's log (locked), runs the log operations
(`extend` or `insert`) and puts the next state on the timer row.

- **Resumed within 60 seconds** of a pause, the stretch continues the block
  before it: `segmentStartedAt` becomes the block's start, so the log counts
  the pause as worked. When it ends, the block's work log (`timers.workLogId`) gets the
  new `endedAt` instead of a second row; Google sync patches its event.
- **A block shorter than 60 seconds** that continues nothing gets no work
  log while it may still be a mis-tap. Ended or completed right away, it never
  reaches the log. Resumed after a minute or more, it was work: it gets a log
  of its own (on `resume`), and the new stretch starts a block. Several
  short stretches with short pauses between them form one block and are
  logged once they reach a minute together.
- While paused, the timer row keeps `blockStartedAt`, `pausedAt` and
  `workLogId` (migration `1795900000000-StopwatchBlocks`). Within a block,
  resuming takes the logged block's length off `elapsedMilliseconds` again
  and closing it adds the whole block back, so the block counts once. When
  the block's log can still be found (same id, its start before the new
  end), it is extended to the new end, even if it was corrected meanwhile;
  only a log that was deleted, or whose start was moved to or past the new
  end, makes the block logged anew (or dropped, if under a minute).
- **What the stopwatch shows is only the time it ran** (`elapsedAt` in
  `timer-math.ts`): a short pause inside a block is counted by the block's
  log but kept in `timers.idleMilliseconds` and left out of the shown time,
  and a stretch under a minute that has no log yet stays in view while
  paused (`unloggedBlock`). So the time neither jumps back on a pause nor
  ahead on resume. When a block is over (resumed after a minute or more),
  `elapsedMilliseconds` becomes the shown time, its pauses left out (a short
  block gets its log at that moment), and `idleMilliseconds` goes back to 0
  (migration `1796300000000-StopwatchIdle`). So `elapsedMilliseconds` is the
  base the stopwatch counts on from, not the sum of its logged blocks.
- The twelve-hour cap applies per block (it is measured from
  `segmentStartedAt`); a cut stretch pauses long ago, so it never continues.

### Starting from logged time

`POST /timers` starts `elapsedMilliseconds` at the time already logged for the
target, all sources, overlaps counted once (`loggedMilliseconds`, using
`coveredMilliseconds` of `work-logs/work-time.ts`): a reopened quest, or a
daily run started again later, counts on from what it already has. As the
log counts short pauses inside a block as work and leaves out a last stretch
under a minute, this can differ slightly from what an earlier stopwatch on
the target showed. The Soll
compares against this total. When it is already passed at the start, the
stopwatch is marked reached right away (`targetReachedAt` and `pushHandledAt`
set to the start), so nothing announces it.

Foreground devices poll every **3 seconds**, and refresh on focus/visibility
return. This is eventual synchronization, not a real-time guarantee.

## Backend

Protected endpoints, ownership taken exclusively from the session:

- `GET /timers/current` -> `{ serverNow, timer }`, `timer: null` without a running
  or paused stopwatch. `timer` carries `state`, `elapsedMilliseconds` (as of
  `serverNow`), `targetMinutes` and `targetReachedAt`.
- `POST /timers` -> `{ kind: "todo" | "occurrence", targetId, replaceTimerId? }`.
  The target minutes come from the target. A conflicting active stopwatch returns
  HTTP 409 with `code: ACTIVE_TIMER_EXISTS`.
- `POST /timers/:id/pause`, `/resume`, `/stop` with JSON `{}`.
- `PATCH /timers/:id/duration` with `{ durationMinutes }` sets the target.

Foreign target/timer IDs return 404. Per-user row locks serialize transitions
across devices and server processes; a partial unique index enforces at most one
running/paused row. Database checks enforce exactly one target, a valid state and
that exactly a running stopwatch has a running stretch. Old stopped rows are
retained.

The push worker notifies once when the target is reached (`targetReachesAt` /
`targetReachedAt`); see `timer-push.md`.

## Todo-Dump -> Today -> later tracking

Completing an unscheduled Todo does **not** invent a planned date:

```text
scheduledDate = null
completed = true
completedAt = actual server completion instant (UTC timestamp)
```

The Dump lists only open unscheduled Todos. Today lists completed Todos whose `completedAt`, converted to **Europe/Berlin**, falls on today, including those from the Dump. The card uses the actual completion date/time. A reload, title edit, duration edit or repeated `completed: true` PATCH keeps `completedAt` unchanged. Prior-day completions remain in PostgreSQL and in `GET /todos`, but are not shown in today's planner. A future historical/statistics query must bucket **completedAt**, not scheduledAt or updatedAt. No historical calendar endpoint is introduced here.

Reopening intentionally undoes completion (`completedAt = null`); an unscheduled Todo returns to the Dump. This is not an immutable completion-event audit log. If repeated completion/undo cycles must remain auditable later, introduce a separate event log explicitly rather than inferring it from the current Todo state.

## Local validation

Use the same environment and commands as `docs/auth-and-ownership.md` and `docs/e2e-and-ci.md`. No new secrets or package dependencies are required. Backend E2E reset and browser reset include `timers` together with referenced tables, without CASCADE. Only guarded disposable test databases are reset.

```powershell
# backend
npm run lint
npm test
npm run build
npm run test:e2e
# frontend
npm test
npm run build
npm run typecheck:e2e
npm run test:e2e
```

CI discovers the new tests automatically. Browser tests use real HTTP, sessions, isolated PostgreSQL and Mailpit and a second browser context for device synchronization. Unit tests cover stale responses/logout cleanup, monotonic clock arithmetic and confirmation flows. Integration tests cover concurrent start, expiry after absence, paused slot retention, atomic/stale replacement, owner isolation, occurrence-only overrides and Berlin-midnight completion bucketing.
