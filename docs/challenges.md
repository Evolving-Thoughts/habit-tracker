# Monats-Challenge

One Daily held for one calendar month: per person and month at most one
challenge, a reference to a Daily plus the month. It is done only when every
run the Daily's own rhythm made due in the month was done; otherwise the
result is an honest percentage ("90 % geschafft (27 von 30)"), never a
warning. The code lives in `backend/src/month-challenges/`; the UI in
`MonthChallengeCard.vue` (Heute), `MonthChallengeSection.vue` and
`MonthChallengeDialog.vue` (Dailies), `ChallengeMark.vue` (the rows' marker)
and the words in `utils/month-challenge.ts`.

## Data

- `month_challenges (id, userId, habitId, month, startDate, title,
  reminderMinutes, remindedOn, doneCount, dueCount, createdAt, endedAt)`,
  unique `(userId, month)`.
  - `month` is the first day of the month; `startDate` the first counted
    day: the day it was created in the running month, the month's first
    for one prepared for the next month.
  - `title` keeps the Daily's title when the challenge is created; the API
    shows the live title while the Daily exists and this one once it is
    gone.
  - `reminderMinutes`: minutes after midnight (Berlin) of the daily
    reminder, 0–1439, default 1140 (19:00); null for none. `remindedOn` is
    the Berlin day the reminder was last handled.
  - `doneCount`/`dueCount`: the frozen result, null while it can still
    change (a check holds both null or `0 <= doneCount <= dueCount`).
  - `endedAt`: when it was ended before the month was over, by hand or
    because its Daily was deleted.
- `userId` references `users` (`ON DELETE CASCADE`); `habitId` references
  `habits` (`ON DELETE SET NULL`). Dailies are deleted softly, so deleting
  one sets `habitId` to null itself (`closeChallengesOfHabit`, called from
  `HabitSchedulingService.removeHabit`).
- Migration `1796500000000-MonthChallenges` creates the table and lets
  `push_deliveries` hold the reminder (see Reminder).

## Counting (`challenge-progress.ts`)

The window is `startDate` to the month's last day (to the day it ended, for
one ended early). The rhythm is the Daily's own, version by version, read
with the scheduler's rules (`isScheduledOn`, `slotStartsAt`, `expiresAt` in
`habits/scheduling/schedule-rules.ts`), so a schedule change within the
month counts both rhythms on their days.

**Fixed rhythms** (every day, every n days, fixed weekdays) count slot by
slot. Every slot in the window is one due run:

| Slot | Counts as |
|---|---|
| run `completed`, done by the window's last day | done |
| run `completed` only after the month | missed |
| run `skipped`, by hand ("Überspringen") or by the scheduler | missed (strict: unlike the series, skipping does not excuse) |
| run `cancelled` (schedule change, already done today) | not due |
| run `pending` or no run stored yet, window still open | still possible |
| run `pending` or no run stored yet, window closed or month over | missed |

A slot without a stored run (the scheduler has not generated it yet, or the
Daily was paused) counts by the clock like an open run, so pausing does not
excuse a run either.

**Weekly targets** ("3× pro Woche") count week by week, Monday to Sunday,
cut to the window. A week asks for the target in proportion to the days of
it the window covers, rounded to the nearest whole run
(`weeklyDue = round(target × coveredDays / 7)`; a seventh never lands on a
half): a whole week asks for the full target, 3× a week asks for 0, 1, 1, 2,
2, 3, 3 runs over 1–7 covered days, and never more runs than days. Done runs
(by the day they were done, within the covered days) count up to that, so a
fourth run does not make up for another week. In a week still running, what
is left counts as still possible as far as there are days left for it (one
run a day, today only while today's run is not done yet); the rest is missed
already. Weeks that are over count what is left as missed.

The tally is `{ done, missed, remaining }`; `total = done + missed +
remaining` is every due run of the month. `percent` is `floor(done × 100 /
total)`, so 100 % means every run.

**While it runs** Heute and the Dailies say "Tag 12 · 11 von 12 geschafft ·
noch 18": the day of the challenge (1 on `startDate`), the done runs of the
decided ones (today's open run is not decided yet, so it is not among them)
and what can still be done, today's open run included. Before anything is
decided only "Tag 1 · noch 19".

**Closed** is a challenge whose month is over or that was ended. Its result
is frozen once (`freezeIfClosed`): `doneCount` done of `dueCount = done +
missed` decided runs. A month that is over has nothing left; a challenge
ended early drops what was still possible when it ended (today's open run
counts neither way). Status:

- `upcoming`: prepared for next month;
- `running`;
- `succeeded`: month over and `doneCount = dueCount > 0` ("Geschafft");
- `finished`: month over below 100 % ("90 % geschafft (27 von 30)");
- `ended`: ended early by hand or by deleting its Daily ("Beendet am 14.
  Nov. · 1 von 2 geschafft").

**Today's run** (`challengeToday`): the open run that can be done today
(also one carried over into today, not one moved to a later day), else
`done` when a run was done today, else `none`.

## API

All routes need a session and only touch the signed-in person's rows.

| Route | Body | Answer |
|---|---|---|
| `GET /month-challenges` | – | `{ today, current, next, past }`: this month's challenge (running or ended), next month's, earlier ones newest first |
| `POST /month-challenges` | `{ habitId, month: "YYYY-MM", reminderTime?: "HH:MM" \| null }` | the challenge (201); 400 for a month other than this or the next or a paused Daily, 404 for a Daily not one's own, 409 when the month has one |
| `PATCH /month-challenges/:id` | `{ reminderTime: "HH:MM" \| null }` | the challenge; 409 once closed |
| `POST /month-challenges/:id/end` | – | the ended challenge with its frozen result; 409 unless it runs |
| `DELETE /month-challenges/:id` | – | 204, also when there was nothing |

A challenge answers `{ id, month, startDate, endDate, habitId, title,
reminderTime, status, endedAt, day, days, done, missed, remaining, total,
percent, todayRun, todayOccurrenceId }`. Reading brings the running
challenge's Daily up to now first (the scheduler's `reconcile`), so today's
run is stored; closed results are frozen on the way.

Beside its own routes:

- `GET /day-planner/today` carries the running challenge as
  `monthChallenge` (null without one) for Heute's card, and every habit item
  says `monthChallenge: true` when its Daily carries it (the marker);
- `GET /day-planner/plan` marks runs of that Daily within its month, `GET
  /habits` and `GET /habits/:id` mark the Daily;
- `GET /week-review` answers `monthChallenge: { title, done, due }`: the
  challenge of the month of the week's last day (today in the running
  week), counted as of the end of that day: done of the decided runs. Null
  without one begun by then or once its Daily is deleted.

Next month's challenge can be created at any time; the Dailies offer
"Challenge für Dezember festlegen" from the 16th on.

## Reminder

One Web Push a day at the challenge's reminder time, only while today's run
is due and still open, only on devices with push switched on. The rule is
`challengeReminderDecision(now, state)` in `challenge-rules.ts`
(unit-tested in `challenge-rules.spec.ts`):

- due at the reminder time on Berlin's wall clock (`reminderWindowAt` in
  `push/reminder-window.ts`, shared with Das Beste des Tages), so 19:00 is
  18:00 UTC in winter and 17:00 UTC in summer, also on the change days;
- sendable for 60 minutes from then, never past midnight;
- nothing when the reminder is off, the challenge does not run today
  (not begun, ended, Daily deleted) or `remindedOn` is today;
- due while today's run is done, skipped or not due today: marked handled
  without a push (`settled`);
- a window that passed unsent (server down) is marked handled, not caught
  up.

`PushService.enqueueChallengeReminders()` runs in the push worker's tick
after the Das-Beste reminders: a cheap SQL pass finds running challenges
with a reminder, not yet handled today, of people with a push device; for
each the Daily is reconciled and the decision taken again inside the
person's lock, then `remindedOn` is set and one `push_deliveries` row per
live device is queued with `kind = 'challenge'` and the `day`. The unique
index of deliveries is now `(subscriptionId, kind, day)`, so a device can
hold the challenge's and Das Beste's reminder of the same day.

Before sending and in the receipt `GET /push/deliveries/:id` the server
checks again that today's run is still open. The push payload holds only
ids and the expiry; the receipt answers `{ allowed, title }` with the
Daily's title behind the session, and the service worker shows "Monats-
Challenge" / "Sport ist heute noch offen." with the tag
`habit-month-challenge`, opening `/#/heute`. TTL at most an hour, urgency
`normal`.

## Tests

- `challenge-progress.spec.ts`: the counting rule (skip is missed, mid-month
  start, fixed weekdays, every n days, carry-over, schedule change, weekly
  targets with partial weeks and the running week);
- `challenge-rules.spec.ts`: months, status, window, the reminder decision
  incl. daylight saving;
- `backend/test/month-challenges.e2e-spec.ts`: the API with a fake clock;
  `backend/test/push.e2e-spec.ts` ("daily reminder of the Monats-Challenge");
- `frontend/src/utils/month-challenge.spec.ts`, `MonthChallengeCard.spec.ts`,
  `MonthChallengeSection.spec.ts`, `scripts/push-worker.test.mjs`;
- `frontend/e2e/month-challenge.spec.ts`: started on a Daily in the
  Dailies, shown on Heute with its progress, ticked there.
