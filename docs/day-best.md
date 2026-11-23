# Das Beste des Tages

Every day one short line about the best or most striking moment, so the
year can be scrolled back through later (after the shared diary of Matze
Hielscher and Philip Siefer). Personal only: nothing is shared. The code
lives in `backend/src/day-bests/`; the UI in `DayBestField.vue` (the one
field), `DayBestCard.vue` (Heute), `DayBestDay.vue` (Kalender day),
`ReviewDayBests.vue` (Wochenrückblick), `DayBestSetting.vue` (Einstellungen)
and `views/DayBestView.vue` (`#/das-beste`). Rules without a database sit
in `day-best-rules.ts` (backend) and `utils/day-best.ts` (frontend).

## Data

- `day_bests (id, userId, date, text, createdAt, updatedAt)`, unique
  `(userId, date)`. `date` is the Berlin day. `text` is plain, one line:
  whitespace runs (line breaks included) collapse to one space, it is
  trimmed, then at most 280 characters (`varchar(280)`, a check refuses an
  empty one). An emptied line deletes the row.
- `day_best_settings (userId PK, cardMinutes, reminderEnabled, remindedOn)`:
  the card time as minutes after midnight (0–1439, default 1200 = 20:00),
  the evening reminder (default on) and the Berlin day the reminder was
  last handled. No row means the defaults. It is a table of its own, like
  `weekly_quest_targets` for the weekly goal; device-only choices (theme,
  push opt-in, single keys) stay on the device.
- Both reference `users` with `ON DELETE CASCADE`.
- Migration `1796400000000-DayBests` creates both and widens
  `push_deliveries` (see Reminder).

## API

All routes need a session and only touch the signed-in person's rows.

| Route | Body / query | Answer |
|---|---|---|
| `GET /day-bests?from=YYYY-MM-DD&to=YYYY-MM-DD` | both included, at most 400 days, `from <= to` | `{ entries: [{ date, text }] }`, newest first |
| `GET /day-bests/months` | – | `{ today, months: [{ month: "YYYY-MM", count }] }`, newest first, only months with lines |
| `GET /day-bests/:date` | – | `{ date, text }`, `text` empty without a line |
| `PUT /day-bests/:date` | `{ text }` | `{ date, text }` as stored; empty deletes |
| `DELETE /day-bests/:date` | – | 204, also when there was nothing |
| `GET /day-best-settings` | – | `{ cardTime: "HH:MM", reminderEnabled }` |
| `PUT /day-best-settings` | `{ cardTime?, reminderEnabled? }` | the settings after the change; what is left out stays |

A future day (after Berlin's today) answers 400 "Das Beste des Tages gibt
es nur für heute und vergangene Tage."; past days can be written any time.
A bad date, a line over 280 characters after trimming, an unknown field or
a time other than `00:00`–`23:59` answer 400 as well.
`backend/test/day-bests.e2e-spec.ts` covers the routes.

## Where it shows

- **Heute:** from the card time on, at the end of the day's list, a calm
  card "Das Beste des Tages?" with the field; before it nothing at all.
  The clock (`useDayClock`) wakes exactly at the card time, no polling. A
  written line stands quietly with a pencil. No count, no streak.
- **Kalender, Tag:** the field below the reflection, for today and every
  day before (not for days ahead).
- **Das Beste** (`#/das-beste`, key B): the timeline, see `DESIGN.md`.
  `?monat=YYYY-MM` starts it at a month, `?tag=YYYY-MM-DD` (from the search)
  at a day, focused. It loads three months with lines per step (one range
  read per month, since months with lines can lie years apart) when the end
  comes into view or on "Ältere Monate laden". The month heading counts
  "12 von 30 Tagen"; in the running month only the days so far count.
- **Wochenrückblick:** "Das Beste der Woche" between Erledigt and the three
  questions, Monday to Sunday; a week without lines has no card.
- **Search:** `kind: "day-best"` text hits, label "Das Beste vom 18. Nov."
  (`search.md`); picking one opens `#/das-beste?tag=…`.

## The field

One component everywhere (`DayBestField.vue`): a two-line textarea with
`maxlength="280"`. Enter saves instead of breaking the line (not while an
IME composes), leaving the field saves what changed, Escape gives up what
was typed. "Speichert …" / "Gespeichert" stand in a polite status region;
a failed save keeps the text and offers "Erneut speichern". From 240
characters a counter "245 / 280" shows, read out as "Noch 35 von 280
Zeichen frei." and tied to the field with `aria-describedby`.

## Evening reminder (Web Push)

An hour after the card time, if the day still has no line, one push "Was
war heute das Beste?" ("Eine Zeile reicht."), at most once per day, only to
devices with push turned on (`timer-push.md` for opt-in, sessions and the
service worker), only while the reminder is on in Einstellungen.

The rule is `reminderDecision(now, state)` in `day-best-rules.ts`
(unit-tested in `day-best-rules.spec.ts`):

- due at card time + 60 minutes on Berlin's wall clock
  (`atWallClockMinutes`), so it moves with daylight saving: 21:00 is 19:00
  UTC in summer and 20:00 UTC in winter, also on the change days; a time in
  the spring gap moves forward (02:30 → 03:30);
- sendable for 60 minutes from then, never past midnight; a card time from
  23:00 on leaves no room, so there is no reminder (Einstellungen says so);
- nothing when switched off, when today already has a line, or when
  `remindedOn` is today;
- a window that passed unsent (server down) is marked handled, not caught up.

`PushService.enqueueDayBestReminders()` runs in the push worker's tick
(about every second, like the timer fan-out): a cheap SQL pass finds people
with a push subscription, the reminder on, not yet handled today and no line
today; for each the decision is taken again inside the person's lock, then
`remindedOn` is set and one `push_deliveries` row per live device is queued.

`push_deliveries` got a `kind` (`timer` | `day-best`, default `timer`):
a reminder has `day` instead of `timerId` (a check holds exactly one of
them), and a unique index on `(subscriptionId, day)` keeps it to one per
device and day. Sending reuses the timer path (retries, gone endpoints,
session check); before sending and in the receipt `GET
/push/deliveries/:id` it checks that the day still has no line and the
reminder is still on, so a line written meanwhile cancels it. The payload
holds only ids and the expiry; the service worker shows fixed words with the
tag `habit-day-best` and opens `/#/heute` when no app window is open. Its
TTL is at most an hour, urgency `normal`.

Tests: `backend/test/push.e2e-spec.ts` ("evening reminder of Das Beste des
Tages") with a fake clock and transport, `frontend/scripts/push-worker.test.mjs`
for the worker.
