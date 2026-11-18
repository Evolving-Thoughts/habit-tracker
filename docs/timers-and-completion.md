# Synced stopwatch and Todo completion

## Scope

One running **or paused** stopwatch per signed-in user, shared by all devices.
It counts up. The planned minutes of its target are an optional **target**: the
moment it is reached is recorded and notified once, and the stopwatch runs on.
Nothing is completed automatically.

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
  `backend/src/timers/timer-target.ts`).
- **Fokus-Modus** (`#/fokus`, `FocusView.vue`): one quest in view with its campaign,
  its why and the stopwatch large; no navigation and no timer bar. What the
  stopwatch runs on stays in view; otherwise `currentItem` decides, the rule of
  Heute's focus card (`docs/day-order.md`): an appointment from its start until
  its end (planned duration, or 30 minutes), else the head of the day's order.
  The view switches by itself at those moments. An appointment shows its time
  range ("Termin 10:00–10:30") and has no "Später"; Heute's focus card leaves
  out the link to the Fokus-Modus while an appointment is on it. With an empty
  order and an appointment still to come, it says "Nichts in der Reihenfolge"
  and names the next appointment instead of "Alles erledigt". "Erledigt" brings up the next one, "Später" puts
  the quest behind the rest of the order and ends its stopwatch. Space
  starts/pauses, Ctrl+Enter completes, Escape leads back to Heute. A quest
  shows its notes below the actions (see `quest-notes.md`); while typing there,
  Space writes a space and the first Escape only leaves the text.

## Time, devices and forgotten stopwatches

PostgreSQL stores the time of all finished stretches (`elapsedMilliseconds`) and
the start of the running one (`segmentStartedAt`). The time worked is derived from
these instants (`timer-math.ts`), never from a counter that ticks, so a locked
phone or a restarted server cannot make it drift. The browser counts on from the
server's answer on a monotonic clock.

Every stretch becomes a work log when it ends (pause, end, completion); the
calendar shows them as the Logbuch (see `logbook.md`). A stretch
that nobody ends counts for at most **twelve hours**: the next read cuts it there
and leaves the stopwatch paused, so a stopwatch forgotten overnight does not turn
into work that never happened.

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
