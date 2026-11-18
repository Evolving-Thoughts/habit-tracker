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
  phone, the time axis `components/DayTimeline.vue`: the plan (appointments,
  timed dailies, events of the read calendars) in one lane, the Logbuch in the
  other. Stretches are white blocks with the campaign's stripe (a neutral one
  without campaign), title and duration; a block is never smaller than a tap
  target, its label names title, real times, duration and campaign, and a tap
  opens it for correcting. Below the axis `DayWorkLogs.vue` lists the stretches
  in words (correct, delete) and adds time by hand. A day without a stretch
  says so in one quiet line. Days ahead have no Logbuch.
- **Week**: a legend of the week's work by campaign, then per day a stacked bar
  in the campaigns' marks, scaled to the longest day, with the total as text and
  the split in words for screen readers.
- **Month**: the day's worked time as a small figure in the cell ("2 Std. 15
  Min.", on a phone "2:15 h"); the cell's label says it in full.
- Pure rules in `utils/logbook.ts` (positions on the axis, side-by-side layout
  of overlapping blocks, the axis range, labels). The colour of a campaign comes
  from `campaignMark` in `utils/category-mark.ts`: its stored colour, else one
  from its title (see `quest-hours.md`).
