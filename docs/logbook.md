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
- **Day**: the list of the day (reflection, done, skipped, open, weekly goals)
  and, beside it on wide screens (from 56rem, page up to 64rem) or below it on a
  phone, the section "Logbuch" with the day's total and the time axis
  `components/DayTimeline.vue`. Its two lanes are named for what they hold,
  "Geplant" and "Gemessen", so the section and a lane never both say
  "Logbuch". "Geplant" has the appointments, timed dailies and events of the
  read calendars, and a slim mark (the history dot and the title, read as
  "…, erledigt um 05:37") for each completion without a planned time, at the
  time it was ticked off; a completed appointment stays its block. "Gemessen"
  has the stretches: white blocks with the campaign's stripe (a neutral one
  without campaign), title and duration; a block is never smaller than a tap
  target, its label names title, real times, duration and campaign, and a tap
  opens it for correcting.
- **The axis window** (`axisHours`): from the full hour of the earliest
  block, mark or stretch to the full hour after the latest one as drawn (a
  short block still takes its least room, `drawnEnd`). It never starts later
  than 8 or ends earlier than 18 (`DEFAULT_HOURS`), so a quiet day still reads
  as a day and an empty one shows 8 to 18; a stretch at 05:37 starts it at 5.
- Below the axis `DayWorkLogs.vue` lists the stretches in words (correct,
  delete; the source reads "Stoppuhr" or "Nachtrag"). Adding time by hand
  waits behind one quiet button "Zeit nachtragen" (`aria-expanded`): it opens
  the fields in place with the focus in the first, Abbrechen or Escape close
  them and give the focus back to the button. A refused entry keeps what was
  typed next to the reason; a saved one closes the form, empties it and gives
  the focus back. A day without a stretch says so in one quiet line ("Heute
  wurde noch keine Zeit gemessen."). Days ahead have no Logbuch; their section
  is "Termine".
- **Deleting a stretch** has an undo, the toast of the calendar ("Abschnitt
  „Lesen“ gelöscht · Rückgängig", see below).
- **Week**: a legend of the week's work by campaign, then per day a stacked bar
  in the campaigns' marks, scaled to the longest day, with the total as text and
  the split in words for screen readers. A day without plans or entries but
  with measured time says both ("Nichts geplant · 2 Std. 10 Min. gemessen",
  `daySummary`), so the words never contradict the bar.
- **Month**: the day's worked time as a small figure in the cell ("2 Std. 15
  Min.", on a phone "2:15 h"); the cell's label says it in full.
## Deleting with undo

"Löschen" in the day's list does not send the `DELETE` at once. The stretch
leaves the list and the axis immediately (`CalendarView` keeps a set of
held-back ids and `CalendarDay` filters them), the focus moves to the
neighbouring row, and the calendar's `UndoToast` offers "Rückgängig" for
five seconds. The `DELETE` goes out when that offer ends without being
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
