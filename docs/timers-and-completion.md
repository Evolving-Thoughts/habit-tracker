# Synced timers and Todo completion

## Scope

One running **or paused** timer per signed-in user, shared by all devices. Existing verified-email authentication and ownership remain in force. A completed timer releases the active slot; only the latest timer is shown. This PR adds no Web Push, service worker alarm, native Android alarm, or automatic task completion.

## UI

- A saved duration adds a round Play icon to open Todos (Today and Dump) and due Habit occurrences. It starts immediately. In Habits, Play is disabled when there is no open due occurrence; future and paused Habits cannot start an arbitrary occurrence.
- Optional **Standarddauer in Minuten** in Habit creation/editing. An occurrence override wins over that default.
- A sticky timer bar remains visible across all three views: Play = resume, two bars = pause, square = stop. The bar is above the content and stays visible on long lists. Controls are 44px circles with SVG, accessible names and tooltips.
- Stop and switching to another target require explicit confirmation. Switching checks the exact old timer ID and changes both timers atomically. A stale device cannot accidentally stop a newer timer. Stop/duration dialogs remember their timer ID and close on a remote target switch.
- Pause before changing the total duration. Already elapsed time is retained: 2-minute timer after 30 seconds -> change to 3 minutes -> 2:30 remaining. If the shortened total is already elapsed, the timer finishes.
- Duration changes persist on the Todo or **only on that specific Habit occurrence**. They do not change the Habit default. Editing a target's default/planned duration outside the timer does not silently change the active deadline.
- Expiration shows **Zeit abgelaufen**, not automatic completion. A separate check icon completes the target explicitly; Stop closes a finished timer.
- Resolving/deleting the linked target, pausing the Habit, or cancelling/expiring its occurrence stops an obsolete linked timer during the next reconciliation. This includes an occurrence becoming non-actionable at a schedule/week boundary. There is no independent timer detached from a target.

## Locked Android / multiple devices

PostgreSQL stores an absolute UTC `endsAt`. The browser derives the display from the server clock plus a monotonic local anchor, rather than decrementing a counter. Reloading or returning after a locked/backgrounded phone reconstructs the correct remaining time. Paused timers store their remaining milliseconds, with no live deadline.

Foreground devices poll every **3 seconds**, and refresh on focus/visibility return. This is eventual synchronization, not a hard real-time latency guarantee. An offline device can display its last known deadline, but cannot know about changes on another device until reconnecting; an error is shown rather than silently claiming synchronization.

**There is no notification/sound guarantee while the screen is locked.** Push/background delivery and Android alarm reliability are separate follow-up work. Physical Android has not been tested by the agent; mobile Chromium emulation is not a substitute.

## Backend

Protected endpoints, ownership taken exclusively from the session:

- `GET /timers/current` -> `{ serverNow, timer }` (`timer: null` if absent/stopped).
- `POST /timers` -> `{ kind: "todo" | "occurrence", targetId, durationMinutes?, replaceTimerId? }`. Omitted duration uses the saved target duration/default. A conflicting active timer returns HTTP 409 with `code: ACTIVE_TIMER_EXISTS`.
- `POST /timers/:id/pause`, `/resume`, `/stop` with JSON `{}`.
- `PATCH /timers/:id/duration` with `{ durationMinutes }`, paused only.

Foreign target/timer IDs return 404. Global exact-Origin and JSON checks apply. Per-user row locks serialize transitions across devices and server processes; a partial unique index enforces at most one running/paused row. Database checks enforce exactly one target, valid state/duration/remainder/deadline. Target validation and duration writes happen in the same transaction. Finished timers are reconciled lazily on a read/action; `finishedAt` is the original deadline, not the later poll time.

Minutes: integer 1..10080 (7 days). Habit/occurrence duration columns are nullable. Development `synchronize` adds the new table/columns; no legacy migration, backfill or development database deletion is needed for this PR. Production schema migrations are still separate. Old stopped/finished timer rows are retained; retention/cleanup is later operational work, not automatic deletion.

## Todo-Dump -> Today -> later tracking

Completing an unscheduled Todo does **not** invent a planned date:

```text
scheduledAt = null
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
