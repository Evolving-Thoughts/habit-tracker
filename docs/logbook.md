# The Logbuch: measured work in the calendar

The calendar shows what was actually worked on next to what was planned, on
day, week and month, and exports finished stretches into the app's own Google
calendar.

## Model

Every closed stretch of work is a row in `work_logs`
(`backend/src/work-logs/work-log.entity.ts`): a plain target id (`todoId` or
`occurrenceId`), a copied `title`, `startedAt`, `endedAt` and
`source: 'timer' | 'manual'`. The stopwatch writes a row when a stretch ends
(pause, end, completion, see `timers-and-completion.md`); a running stretch has
no row yet. Rows are added, corrected and deleted by hand through
`POST /work-logs`, `PATCH /work-logs/:id` and `DELETE /work-logs/:id`.

## Rules

- **One definition of "worked on a day"**: `workedMinutes` in
  `backend/src/work-logs/work-time.ts`. Overlapping stretches count once, a
  stretch across Berlin midnight is cut onto both days (`onDay`), and day
  boundaries come from `common/date/local-day.ts`, so a 23- or 25-hour day is
  counted as it is. Heute, the Fokus-Modus and the calendar all use it.
- **By campaign**: `workedMinutesBy` splits a day's minutes by a key. Time that
  two stretches share goes to the one that started first, and the parts are
  rounded on their running sum, so they add up to exactly the day's minutes.
- **Campaign of a stretch**: the campaign of its quest, or of the goal counting
  its daily, as the planner names it today (`withCampaigns` in
  `work-logs/day-logs.ts`, using `todo-ancestry.ts`). A deleted quest has none.
  Time on campaigns is also counted as quest hours (`quest-hours.md`).
- A stretch belongs to every day it covers (`logsOfDays`).

## Read: inside `GET /history`

The calendar's existing read carries the Logbuch; there is no second read
path (the old `GET /work-logs?date=` is gone). Every day of the answer has

```ts
work: {
  minutes: number;               // the day's worked minutes
  campaigns?: { campaign: { id, title, color, icon } | null; minutes }[]; // day and week
  logs?: HistoryWorkLog[];       // day and week
}
```

`HistoryWorkLog` has `id`, `title`, `startedAt`, `endedAt`, `minutes` (the full
length of the stretch), `source`, `todoId`, `occurrenceId`, `habitId` and
`campaign`. A stretch across midnight is listed on both days at full length;
the day's `minutes` count only its part of the day. The month only gets
`minutes`. The `filter` applies: Quests keeps stretches on quests, Dailies
those on runs.

Like the rest of history, it is one `REPEATABLE READ` snapshot that writes
nothing, scoped to the signed-in user. The day view also gets the read
calendars' events (`external`), which before only the month had.

## Google calendar: export only

The app writes only into its own calendar (`connection.calendarId`). Shared
and other calendars are only read.

- `CalendarLinkEntity` has a third target, `workLogId`; a check constraint
  (`CHK_calendar_link_target`) keeps exactly one of `todoId`, `occurrenceId`,
  `workLogId` (migration `1795200000000-LogbookEvents`).
- `logChanges` in `calendar-sync.service.ts` follows the outgoing pattern of
  todos and runs: every stretch of **at least five minutes** becomes an event
  at its real start and end; a correction patches it; a deleted stretch, or one
  shortened below five minutes, deletes it. New stretches are exported back
  31 days, so connecting does not write the whole past at once.
- The events say what they are: the stretch's title as summary and the
  description "Logbuch · gemessene Arbeitszeit", plus "Kampagne: …" when there
  is one. They carry the app's private marker like every app event, so an event
  without its link is never adopted as a quest.
- **Incoming**: an edit of a Logbuch event in Google changes nothing, neither
  the log nor a plan. If the user deletes one, its link stays and is marked
  `suppressed`, the mechanism already used for habit runs: a suppressed link is
  never written again, and it goes away (without a call to Google) once the log
  is deleted. A deletion is seen when the event is in the read window (from
  today on), or, for an older event, when the next correction meets a missing
  event.

## Frontend

- `views/CalendarView.vue` keeps navigation, loading, the filter and the move
  dialog; `components/CalendarMonth.vue`, `CalendarWeek.vue` and
  `CalendarDay.vue` draw the three views (`WeeklyTargets.vue` is shared).
- **The day calendar** (`components/DayCalendar.vue`) is one column per day
  where the plan and the Logbuch share one hour axis: appointments, timed
  dailies and the events of the read Google calendars (read-only), a slim
  mark for each completion without a planned time at the moment it was ticked
  off (the history dot and the title, read as "…, erledigt um 05:37"; a
  completed appointment stays its block), and the stretches as white blocks
  with the campaign's stripe (a neutral one without campaign), title, times
  and the campaign chip. Blocks that overlap stand side by side
  (`calendarBlocks` → `layoutLane`); a block is never smaller than a tap
  target. On today an ink line marks now, with the time in the hour labels.
  Heute (beside the list from 64rem, `TodayCalendar.vue` reads the day from
  `GET /history`), the Kalender's day and each column of its week use it;
  in the week it is `compact`: no head, the hour labels and the scrolling
  are the week's.
- **The axis window** (`axisHours`): from early morning (6, `DEFAULT_HOURS`)
  to midnight; an earlier block, mark or stretch starts it at that full hour
  (a stretch at 05:37 starts it at 5). A single day scrolls in its own column
  and opens on now (today), else on its first entry, else on the morning.
- **Correcting a stretch**: a tap on its block opens "Abschnitt korrigieren"
  (`WorkLogDialog.vue`: start, end, Speichern, Löschen, Abbrechen; the dialog
  keeps the days a stretch covers across midnight). Its top and bottom edges
  drag with pointer events (mouse, pen and touch; `touch-action: none` on
  the edge): the edge follows the pointer on a 5-minute grid
  (`resizedEdge`, `SNAP_MINUTES`) with the live times in the block, never
  past the other edge (a stretch keeps 5 minutes), never before midnight and
  never after now on today. Releasing saves through `PATCH /work-logs/:id`
  with only the moved edge changed; the block keeps its new place until the
  reload brings it, and a status line says the new times. Escape or a
  cancelled pointer drops the drag. Only an edge on the shown day drags (a
  stretch from the evening before keeps its start). The dialog is the
  keyboard's way to the same; appointments are edited in their editor, Google
  events not at all.
- **Adding time**: "Zeit nachtragen" in the head of the day, or a tap on
  empty time in the column, opens the same dialog for a new stretch (Eintrag,
  Von, Bis; from the tapped quarter hour for half an hour, never into the
  future). A refused entry keeps what was typed next to the reason; a saved
  one closes the dialog and gives the focus back. Days ahead have no Logbuch;
  their head is "Termine".
- **Deleting a stretch** has an undo, the toast of the view ("Abschnitt
  „Lesen“ gelöscht · Rückgängig", see below; Heute and the Kalender share it
  through `useLogRemoval`).
- **Week**: seven day columns on one shared hour axis; above each the day,
  its worked time and what it holds without a time ("5 Quests · 2 Dailies",
  `untimedOfHistoryDay`), with the day counted in words for screen readers
  (`daySummary`: "Nichts geplant · 2 Std. 10 Min. gemessen" for a day with
  time but no plan). Today's column is tinted and carries the now line.
- **Month**: the day's worked time as a figure in the cell ("2 Std. 15 Min.",
  on a phone "2:15 h", in 0.8125rem); the cell's label says it in full. The
  chosen day lists its quests and its Daily runs apart, a done run with the
  time it was done.
## Deleting with undo

"Löschen" in a stretch's dialog does not send the `DELETE` at once. The
stretch leaves the day calendar immediately (`useLogRemoval` keeps a set of
held-back ids and `DayCalendar` filters them), the focus goes to the head
of the column, and the view's `UndoToast` offers "Rückgängig" for five
seconds. The `DELETE` goes out when that offer ends without being
taken: the time is up, the next offer replaces it (another delete, a tick),
the view is left (unmount) or the page closes (`pagehide`; the request uses
`keepalive` so it outlives the page). This is `useUndo`'s `commit` step.

- **Why held back, not deleted and created again:** re-creating through
  `POST /work-logs` would make a different log: a new id, `source: 'manual'`
  instead of `'timer'`, the title copied from the quest as it is now, and a
  404 when the quest was deleted in the meantime. In Google it would delete
  the old event and insert a new one, and a log whose event the user had
  deleted in Google (`suppressed` link) would be exported again, against the
  rule below. Holding the delete back changes nothing on the server until it
  is final, so undo is exact and Google never sees a step that was taken
  back.
- While a delete is held back, the head shows "Logbuch" without its total:
  the server's figure still counts the stretch, and a figure that is about to
  be wrong is not shown.
- If the `DELETE` fails, the stretch comes back with the error next to the
  calendar; a 404 (already deleted elsewhere) counts as done. If the page is
  killed before `pagehide` (a crashed tab), the stretch simply stays: the
  failure mode keeps data, it never loses it.

## Frontend rules

- Pure rules in `utils/logbook.ts` (positions on the axis, completion marks,
  side-by-side layout of overlapping blocks, the axis range, labels). The colour of a campaign comes
  from `campaignMark` in `utils/category-mark.ts`: its stored colour, else one
  from its title (see `quest-hours.md`).
